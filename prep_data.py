#!/usr/bin/env python3
"""Pre-bake climate-day data for the narrative visualization (multi-metric).

For each metric (hot days / hot nights / freezing days / heavy-rain days):
  1. Observed:  Open-Meteo Historical Archive: daily tmax/tmin/precip per city,
                1980-1989 and 2015-2024 -> days meeting the metric -> decade avg.
                (one API call per era returns all fields, so all metrics share it)
  2. Projected: World Bank CCKP CMIP6 0.25° NetCDF (public S3): the metric's annual
                count, ssp245 + ssp585, median ensemble; nearest grid cell to city;
                averaged over 2040-2049 and 2076-2085, plus a 2015-2024 model base.
  3. Bake:      delta-method bias correction, write data/heat.json.

Run via `make data`. Downloads ~2.8 GB of NetCDF once into data/raw/ (gitignored).
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

import netCDF4
import numpy as np

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw"
OUT = HERE / "data" / "heat.json"

# metric key -> (display, cckp var, open-meteo daily field, op, threshold)
# op: ">=" counts days at/above threshold; "<" counts days below it.
METRICS = {
    "hot-days":     ("Hot days",     "hd30",  "temperature_2m_max", ">=", 30),
    "danger-days":  ("Dangerous heat", "hd40", "temperature_2m_max", ">=", 40),
    "hot-nights":   ("Hot nights",   "tr26",  "temperature_2m_min", ">=", 26),
    "freezing":     ("Freezing days", "fd",   "temperature_2m_min", "<",  0),
}
OM_FIELDS = sorted({m[2] for m in METRICS.values()})

OBS_WINDOWS = {"past": (1980, 1989), "present": (2015, 2024)}
# "base" = model's own present window for delta-method bias correction:
# future = observed_present + (model_future - model_base), clamped to [0, 365].
PROJ_WINDOWS = {"base": (2015, 2024), "near": (2040, 2049), "far": (2076, 2085)}
SCENARIOS = {"low": "ssp245", "high": "ssp585"}

CITIES = {
    # South America
    "recife": ("Recife", "Brazil", -8.05, -34.9),
    "sao-paulo": ("São Paulo", "Brazil", -23.55, -46.63),
    "manaus": ("Manaus", "Brazil", -3.12, -60.02),
    "cuiaba": ("Cuiabá", "Brazil", -15.6, -56.1),
    "rio": ("Rio de Janeiro", "Brazil", -22.91, -43.17),
    "brasilia": ("Brasília", "Brazil", -15.79, -47.88),
    "salvador": ("Salvador", "Brazil", -12.97, -38.5),
    "porto-alegre": ("Porto Alegre", "Brazil", -30.03, -51.23),
    "punta-arenas": ("Punta Arenas", "Chile", -53.16, -70.91),
    "puno": ("Puno", "Peru", -15.84, -70.02),
    "caracas": ("Caracas", "Venezuela", 10.48, -66.9),
    "guayaquil": ("Guayaquil", "Ecuador", -2.19, -79.92),
    "ica": ("Ica", "Peru", -14.07, -75.73),
    "santa-cruz": ("Santa Cruz de la Sierra", "Bolivia", -17.78, -63.18),
    "potosi": ("Potosí", "Bolivia", -19.59, -65.75),
    "mendoza": ("Mendoza", "Argentina", -32.89, -68.85),
    "san-julian": ("Puerto San Julián", "Argentina", -49.31, -67.72),
    "coyhaique": ("Coyhaique", "Chile", -45.57, -72.07),
    "ushuaia": ("Ushuaia", "Argentina", -54.8, -68.3),
    "hanga-roa": ("Hanga Roa", "Chile", -27.15, -109.35),

    # North & Central America / Caribbean
    "detroit": ("Detroit", "USA", 42.33, -83.05),
    "chicago": ("Chicago", "USA", 41.85, -87.65),
    "san-jose": ("San Jose", "USA", 37.34, -121.89),
    "phoenix": ("Phoenix", "USA", 33.45, -112.07),
    "houston": ("Houston", "USA", 29.76, -95.37),
    "miami": ("Miami", "USA", 25.76, -80.19),
    "nyc": ("New York City", "USA", 40.71, -74.01),
    "vancouver": ("Vancouver", "Canada", 49.25, -123.12),
    "montreal": ("Montreal", "Canada", 45.51, -73.56),
    "anchorage": ("Anchorage", "USA", 61.22, -149.9),
    "utqiagvik": ("Utqiagvik", "USA", 71.29, -156.79),
    "yellowknife": ("Yellowknife", "Canada", 62.45, -114.37),
    "mexico-city": ("Mexico City", "Mexico", 19.43, -99.13),
    "havana": ("Havana", "Cuba", 23.13, -82.38),
    "honolulu": ("Honolulu", "USA", 21.31, -157.86),
    "laredo": ("Laredo", "USA", 27.51, -99.51),
    "oklahoma-city": ("Oklahoma City", "USA", 35.47, -97.52),
    "fargo": ("Fargo", "USA", 46.88, -96.79),
    "billings": ("Billings", "USA", 45.78, -108.5),
    "monterrey": ("Monterrey", "Mexico", 25.69, -100.32),
    "guadalajara": ("Guadalajara", "Mexico", 20.66, -103.35),
    "merida": ("Mérida", "Mexico", 20.97, -89.62),
    "tijuana": ("Tijuana", "Mexico", 32.53, -117.04),
    "guatemala-city": ("Guatemala City", "Guatemala", 14.63, -90.53),
    "san-salvador": ("San Salvador", "El Salvador", 13.69, -89.19),
    "tegucigalpa": ("Tegucigalpa", "Honduras", 14.1, -87.2),
    "managua": ("Managua", "Nicaragua", 12.15, -86.25),
    "san-jose-cr": ("San José", "Costa Rica", 9.93, -84.09),
    "portland": ("Portland", "USA", 45.52, -122.68),
    "iqaluit": ("Iqaluit", "Canada", 63.75, -68.51),
    "halifax": ("Halifax", "Canada", 44.65, -63.57),
    "panama-city": ("Panama City", "Panama", 8.99, -79.52),
    "san-juan": ("San Juan", "Puerto Rico", 18.47, -66.11),
    "port-of-spain": ("Port of Spain", "Trinidad and Tobago", 10.65, -61.52),

    # Europe
    "reykjavik": ("Reykjavik", "Iceland", 64.15, -21.94),
    "zurich": ("Zurich", "Switzerland", 47.38, 8.54),
    "paris": ("Paris", "France", 48.86, 2.35),
    "berlin": ("Berlin", "Germany", 52.52, 13.4),
    "rome": ("Rome", "Italy", 41.9, 12.5),
    "madrid": ("Madrid", "Spain", 40.42, -3.7),
    "london": ("London", "United Kingdom", 51.51, -0.13),
    "helsinki": ("Helsinki", "Finland", 60.17, 24.94),
    "stockholm": ("Stockholm", "Sweden", 59.33, 18.06),
    "athens": ("Athens", "Greece", 37.98, 23.73),
    "kyiv": ("Kyiv", "Ukraine", 50.45, 30.52),
    "oslo": ("Oslo", "Norway", 59.91, 10.75),
    "edinburgh": ("Edinburgh", "Scotland", 55.95, -3.19),
    "dublin": ("Dublin", "Ireland", 53.35, -6.26),
    "longyearbyen": ("Longyearbyen", "Norway", 78.22, 15.63),

    # Russia
    "st-petersburg": ("St. Petersburg", "Russia", 59.94, 30.31),
    "novosibirsk": ("Novosibirsk", "Russia", 55.03, 82.9),
    "yakutsk": ("Yakutsk", "Russia", 62.0, 129.7),
    "verkhoyansk": ("Verkhoyansk", "Russia", 67.55, 133.39),

    # Middle East
    "dubai": ("Dubai", "United Arab Emirates", 25.2, 55.3),
    "riyadh": ("Riyadh", "Saudi Arabia", 24.7, 46.7),
    "ahvaz": ("Ahvaz", "Iran", 31.32, 48.67),
    "tel-aviv": ("Tel Aviv", "Israel", 32.08, 34.78),
    "sanaa": ("Sana'a", "Yemen", 15.35, 44.19),
    "baku": ("Baku", "Azerbaijan", 40.41, 49.87),

    # Africa
    "lagos": ("Lagos", "Nigeria", 6.52, 3.38),
    "khartoum": ("Khartoum", "Sudan", 15.5, 32.53),
    "tamanrasset": ("Tamanrasset", "Algeria", 22.79, 5.53),
    "johannesburg": ("Johannesburg", "South Africa", -26.2, 28.05),
    "luanda": ("Luanda", "Angola", -8.84, 13.23),
    "kinshasa": ("Kinshasa", "DR Congo", -4.44, 15.31),
    "djibouti-city": ("Djibouti City", "Djibouti", 11.57, 43.15),
    "antananarivo": ("Antananarivo", "Madagascar", -18.88, 47.53),
    "abidjan": ("Abidjan", "Ivory Coast", 5.36, -4.03),
    "praia": ("Praia", "Cabo Verde", 14.92, -23.51),
    "dakar": ("Dakar", "Senegal", 14.72, -17.45),
    "cairo": ("Cairo", "Egypt", 30.04, 31.24),
    "tunis": ("Tunis", "Tunisia", 36.81, 10.18),
    "dar-es-salaam": ("Dar es Salaam", "Tanzania", -6.79, 39.28),
    "windhoek": ("Windhoek", "Namibia", -22.57, 17.08),
    "lusaka": ("Lusaka", "Zambia", -15.42, 28.28),
    "lubumbashi": ("Lubumbashi", "DR Congo", -11.66, 27.48),
    "kisangani": ("Kisangani", "DR Congo", 0.52, 25.19),
    "brazzaville": ("Brazzaville", "Republic of the Congo", -4.27, 15.28),
    "ndjamena": ("N'Djamena", "Chad", 12.13, 15.03),
    "bangui": ("Bangui", "Central African Republic", 4.37, 18.55),
    "kampala": ("Kampala", "Uganda", 0.31, 32.58),
    "douala": ("Douala", "Cameroon", 4.05, 9.7),
    "marrakech": ("Marrakech", "Morocco", 31.63, -7.99),
    "niamey": ("Niamey", "Niger", 13.5, 2.1),
    "addis-ababa": ("Addis Ababa", "Ethiopia", 9.03, 38.74),
    "nairobi": ("Nairobi", "Kenya", -1.29, 36.82),

    # South Asia
    "delhi": ("New Delhi", "India", 28.61, 77.21),
    "nagpur": ("Nagpur", "India", 21.15, 79.09),
    "chennai": ("Chennai", "India", 13.08, 80.27),
    "colombo": ("Colombo", "Sri Lanka", 6.93, 79.86),
    "jodhpur": ("Jodhpur", "India", 26.29, 73.02),
    "kathmandu": ("Kathmandu", "Nepal", 27.72, 85.32),
    "srinagar": ("Srinagar", "India", 34.08, 74.8),
    "dhaka": ("Dhaka", "Bangladesh", 23.81, 90.41),
    "jacobabad": ("Jacobabad", "Pakistan", 28.28, 68.44),

    # East Asia
    "beijing": ("Beijing", "China", 39.9, 116.41),
    "lhasa": ("Lhasa", "China", 29.65, 91.13),
    "tokyo": ("Tokyo", "Japan", 35.68, 139.69),
    "seoul": ("Seoul", "South Korea", 37.57, 126.98),
    "ulaanbaatar": ("Ulaanbaatar", "Mongolia", 47.92, 106.92),
    "nagqu": ("Nagqu", "China", 31.48, 92.07),
    "sapporo": ("Sapporo", "Japan", 43.06, 141.35),
    "naha": ("Naha", "Japan", 26.21, 127.68),
    "taipei": ("Taipei", "Taiwan", 25.03, 121.56),
    "hong-kong": ("Hong Kong", "Hong Kong", 22.28, 114.17),
    "shanghai": ("Shanghai", "China", 31.23, 121.47),
    "guangzhou": ("Guangzhou", "China", 23.13, 113.26),
    "chongqing": ("Chongqing", "China", 29.56, 106.55),

    # Southeast Asia
    "singapore": ("Singapore", "Singapore", 1.35, 103.82),
    "bangkok": ("Bangkok", "Thailand", 13.75, 100.5),
    "manila": ("Manila", "Philippines", 14.6, 120.98),
    "davao": ("Davao City", "Philippines", 7.19, 125.61),
    "jakarta": ("Jakarta", "Indonesia", -6.21, 106.85),
    "medan": ("Medan", "Indonesia", 3.6, 98.67),
    "makassar": ("Makassar", "Indonesia", -5.15, 119.43),
    "jayapura": ("Jayapura", "Indonesia", -2.53, 140.72),
    "denpasar": ("Denpasar", "Indonesia", -8.65, 115.22),
    "balikpapan": ("Balikpapan", "Indonesia", -1.27, 116.83),
    "hanoi": ("Hanoi", "Vietnam", 21.03, 105.85),
    "ho-chi-minh-city": ("Ho Chi Minh City", "Vietnam", 10.82, 106.63),

    # Central Asia
    "almaty": ("Almaty", "Kazakhstan", 43.24, 76.95),
    "tashkent": ("Tashkent", "Uzbekistan", 41.3, 69.24),
    "bishkek": ("Bishkek", "Kyrgyzstan", 42.87, 74.59),
    "dushanbe": ("Dushanbe", "Tajikistan", 38.56, 68.79),
    "ashgabat": ("Ashgabat", "Turkmenistan", 37.96, 58.33),
    "kabul": ("Kabul", "Afghanistan", 34.53, 69.18),

    # Oceania & Pacific
    "auckland": ("Auckland", "New Zealand", -36.85, 174.76),
    "sydney": ("Sydney", "Australia", -33.87, 151.21),
    "alice-springs": ("Alice Springs", "Australia", -23.7, 133.88),
    "perth": ("Perth", "Australia", -31.95, 115.86),
    "hobart": ("Hobart", "Australia", -42.88, 147.33),
    "darwin": ("Darwin", "Australia", -12.46, 130.84),
    "port-moresby": ("Port Moresby", "Papua New Guinea", -9.48, 147.18),
    "suva": ("Suva", "Fiji", -18.14, 178.44),
    "majuro": ("Majuro", "Marshall Islands", 7.1, 171.38),
    "tarawa": ("Tarawa", "Kiribati", 1.33, 172.98),
    "funafuti": ("Funafuti", "Tuvalu", -8.52, 179.22),
    "hagatna": ("Hagåtña", "Guam", 13.48, 144.75),
    "macquarie-island": ("Macquarie Island", "Australia", -54.5, 158.9),

    # Polar
    "nuuk": ("Nuuk", "Greenland", 64.18, -51.72),
    "villa-las-estrellas": ("Villa Las Estrellas", "Antarctica", -62.2, -58.9),
    "grytviken": ("Grytviken", "South Georgia", -54.28, -36.5),
    "esperanza": ("Esperanza Base", "Antarctica", -63.4, -56.997),
    "mcmurdo": ("McMurdo Station", "Antarctica", -77.85, 166.67),
    "south-pole": ("Amundsen-Scott South Pole Station", "Antarctica", -90.0, 0.0),
    "stanley": ("Stanley", "Falkland Islands", -51.7, -57.85),
}


# Open-Meteo Historical Weather API (ERA5 reanalysis), free for non-commercial
# use. Endpoint + parameters documented at:
# https://open-meteo.com/en/docs/historical-weather-api
OPEN_METEO = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}"
    "&daily=" + ",".join(OM_FIELDS) + "&timezone=auto"
)
# World Bank Climate Change Knowledge Portal (CCKP), CMIP6 0.25° projections,
# hosted on the public wbg-cckp S3 bucket. Data + download docs:
# https://climateknowledgeportal.worldbank.org/download-data
CCKP_NC = (
    "https://wbg-cckp.s3.amazonaws.com/data/cmip6-x0.25/{var}/ensemble-all-{ssp}/"
    "timeseries-{var}-annual-mean_cmip6-x0.25_ensemble-all-{ssp}_"
    "timeseries_median_2015-2100.nc"
)


def meets(value: float, op: str, thresh: float) -> bool:
    return value >= thresh if op == ">=" else value < thresh


def fetch_json(url: str, retries: int = 7) -> dict:
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            wait = min(60, 2 ** (attempt + 2))
            print(f"    retry in {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


# ---------- Phase 1: observed (all metrics from one set of daily fields) ----------

def observed_counts(lat: float, lon: float) -> dict[str, dict[str, float]]:
    """era -> metric -> decade-average count of days meeting the metric."""
    out: dict[str, dict[str, float]] = {}
    for era, (y0, y1) in OBS_WINDOWS.items():
        url = OPEN_METEO.format(lat=lat, lon=lon, start=f"{y0}-01-01", end=f"{y1}-12-31")
        daily = fetch_json(url)["daily"]
        times = daily["time"]
        per_year: dict[int, dict[str, int]] = {}
        for i, d in enumerate(times):
            year = int(d[:4])
            counts = per_year.setdefault(year, {mk: 0 for mk in METRICS})
            for mk, (_, _, field, op, thresh) in METRICS.items():
                v = daily[field][i]
                if v is not None and meets(v, op, thresh):
                    counts[mk] += 1
        n = len(per_year)
        if n < (y1 - y0):
            raise RuntimeError(f"only {n} years for {lat},{lon} {era}")
        out[era] = {
            mk: round(sum(c[mk] for c in per_year.values()) / n, 1) for mk in METRICS
        }
        time.sleep(1)
    return out


# ---------- Phase 2: projected ----------

def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    print(f"  downloading {dest.name} ...")
    tmp = dest.with_suffix(".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def projected_counts() -> dict[str, dict[str, dict[str, dict[str, float]]]]:
    """city -> era -> scenario -> metric -> avg count."""
    RAW.mkdir(parents=True, exist_ok=True)
    result: dict[str, dict] = {k: {} for k in CITIES}
    for mk, (_, var, _, _, _) in METRICS.items():
        for scen_key, ssp in SCENARIOS.items():
            nc_path = RAW / f"{var}-{ssp}.nc"
            download(CCKP_NC.format(var=var, ssp=ssp), nc_path)
            ds = netCDF4.Dataset(nc_path)
            arr = ds.variables[f"timeseries-{var}-annual-mean"]
            lats = ds.variables["lat"][:]
            lons = ds.variables["lon"][:]
            years = np.array(
                [int(str(netCDF4.num2date(t, ds.variables["time"].units))[:4])
                 for t in ds.variables["time"][:]]
            )
            for key, (_, _, lat, lon) in CITIES.items():
                li = int(np.abs(lats - lat).argmin())
                lj = int(np.abs(lons - lon).argmin())
                series = np.asarray(arr[:, li, lj], dtype=float)
                for era, (y0, y1) in PROJ_WINDOWS.items():
                    sel = (years >= y0) & (years <= y1)
                    val = float(np.nanmean(series[sel]))
                    (result[key].setdefault(era, {}).setdefault(scen_key, {})[mk]) = round(val, 1)
            ds.close()
            print(f"  sampled {var} {ssp}")
    return result


# ---------- Phase 3: bake ----------

OBS_CACHE = RAW / "observed_cache.json"


def load_obs_cache() -> dict:
    if OBS_CACHE.exists():
        return json.loads(OBS_CACHE.read_text())
    return {}


def save_obs_cache(cache: dict) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OBS_CACHE.write_text(json.dumps(cache))


def main() -> None:
    print("Phase 1: observed (Open-Meteo) ...")
    observed = load_obs_cache()
    for key, (name, _, lat, lon) in CITIES.items():
        if key in observed:
            print(f"  {name} (cached)")
            continue
        print(f"  {name}")
        observed[key] = observed_counts(lat, lon)
        save_obs_cache(observed)
        time.sleep(1.5)  # be gentle on Open-Meteo between cities, not just eras

    print("Phase 2: projected (CCKP NetCDF) ...")
    projected = projected_counts()

    def adjusted(key: str, era: str, scen: str, mk: str) -> float:
        raw = (observed[key]["present"][mk]
               + projected[key][era][scen][mk]
               - projected[key]["base"][scen][mk])
        return round(min(365.0, max(0.0, raw)), 1)

    print("\n=== SCREENING (delta-corrected; present -> 2080 high) ===")
    for mk, (label, *_ ) in METRICS.items():
        print(f"\n--- {label} ---")
        print(f"{'city':<16}{'past':>6}{'now':>6}{'2045':>7}{'2080lo':>8}{'2080hi':>8}")
        for key, (name, *_) in CITIES.items():
            print(f"{name:<16}{observed[key]['past'][mk]:>6}{observed[key]['present'][mk]:>6}"
                  f"{adjusted(key,'near','low',mk):>7}{adjusted(key,'far','low',mk):>8}"
                  f"{adjusted(key,'far','high',mk):>8}")

    baked = {
        "metrics": {mk: METRICS[mk][0] for mk in METRICS},
        "cities": {
            key: {
                "name": name, "country": country,
                "lat": lat, "lon": lon,
                "metrics": {
                    mk: {
                        "past": observed[key]["past"][mk],
                        "present": observed[key]["present"][mk],
                        "near": adjusted(key, "near", "low", mk),
                        "farLow": adjusted(key, "far", "low", mk),
                        "farHigh": adjusted(key, "far", "high", mk),
                    }
                    for mk in METRICS
                },
            }
            for key, (name, country, lat, lon) in CITIES.items()
        },
        "meta": {
            "metricDefs": {mk: {"label": METRICS[mk][0], "cckp": METRICS[mk][1],
                                "op": METRICS[mk][3], "threshold": METRICS[mk][4]}
                           for mk in METRICS},
            "windows": {
                "past": "1980-1989 observed", "present": "2015-2024 observed",
                "near": "2040-2049 modeled (SSP2-4.5)",
                "farLow": "2076-2085 modeled (SSP2-4.5)",
                "farHigh": "2076-2085 modeled (SSP5-8.5)",
            },
            "sources": {
                "observed": "Open-Meteo Historical Archive (ERA5), city point",
                "projected": "World Bank CCKP, CMIP6 0.25° median ensemble, nearest "
                             "grid cell; delta-method bias correction vs model "
                             "2015-2024 baseline, clamped to [0, 365]",
            },
            "generated": date.today().isoformat(),
        },
    }
    OUT.write_text(json.dumps(baked, indent=1, ensure_ascii=False))
    print(f"\nWrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Bake downsampled global grids of the 2080s change for each metric AND each baseline.

For every metric, two grids:
  - "now":  mean(2076-2085, ssp585) - mean(2015-2024, ssp585)      [change since today]
  - "past": mean(2076-2085, ssp585) - mean(1980-1989, historical)  [change since the 1980s]
from the cached CCKP NetCDFs. Output data/heat-grid.json is keyed [metric][baseline];
each entry feeds the country choropleth and the smooth land-clipped contours. Values are
SIGNED (freezing days go negative); JS applies per-metric direction.

Run: .venv/bin/python bake_grid.py  (downloads 4 historical NetCDFs ~1GB once)
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import netCDF4
import numpy as np

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw"
OUT = HERE / "data" / "heat-grid.json"

METRIC_VARS = {
    "hot-days": "hd30", "danger-days": "hd40", "hot-nights": "tr26",
    "freezing": "fd",
}
STRIDE = 6
FUT = (2076, 2085)
NOW = (2015, 2024)
PAST = (1980, 1989)

# World Bank Climate Change Knowledge Portal (CCKP), CMIP6 0.25° historical
# reference series, hosted on the public wbg-cckp S3 bucket. Data + docs:
# https://climateknowledgeportal.worldbank.org/download-data
HIST_URL = (
    "https://wbg-cckp.s3.amazonaws.com/data/cmip6-x0.25/{v}/ensemble-all-historical/"
    "timeseries-{v}-annual-mean_cmip6-x0.25_ensemble-all-historical_"
    "timeseries_median_1950-2014.nc"
)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    print(f"  downloading {dest.name} ...")
    tmp = dest.with_suffix(".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def window_mean(path: Path, var: str, y0: int, y1: int) -> np.ndarray:
    ds = netCDF4.Dataset(path)
    arr = ds.variables[f"timeseries-{var}-annual-mean"]
    years = np.array(
        [int(str(netCDF4.num2date(t, ds.variables["time"].units))[:4])
         for t in ds.variables["time"][:]]
    )
    m = np.nanmean(arr[(years >= y0) & (years <= y1), :, :], axis=0)
    lats = np.asarray(ds.variables["lat"][:], dtype=float)
    lons = np.asarray(ds.variables["lon"][:], dtype=float)
    ds.close()
    return m, lats, lons


def to_grid(delta: np.ndarray, lats: np.ndarray, lons: np.ndarray) -> dict:
    lons180 = np.where(lons > 180, lons - 360, lons)
    order = np.argsort(lons180)
    lons180 = lons180[order]
    delta = np.nan_to_num(delta)[:, order]
    if lats[0] > lats[-1]:
        lats = lats[::-1]
        delta = delta[::-1, :]
    d = delta[::STRIDE, ::STRIDE]
    la, lo = lats[::STRIDE], lons180[::STRIDE]
    h, w = d.shape
    return {
        "width": w, "height": h,
        "lon0": round(float(lo[0]), 4), "lat0": round(float(la[0]), 4),
        "dlon": round(float(lo[1] - lo[0]), 4), "dlat": round(float(la[1] - la[0]), 4),
        "values": [int(round(v)) for v in d.flatten()],
        "range": [int(d.min()), int(d.max())],
    }


def main() -> None:
    out = {}
    for mk, var in METRIC_VARS.items():
        ssp = RAW / f"{var}-ssp585.nc"
        hist = RAW / f"{var}-historical.nc"
        download(HIST_URL.format(v=var), hist)

        fut, lats, lons = window_mean(ssp, var, *FUT)
        now, _, _ = window_mean(ssp, var, *NOW)
        past, _, _ = window_mean(hist, var, *PAST)

        out[mk] = {
            "now": to_grid(fut - now, lats, lons),
            "past": to_grid(fut - past, lats, lons),
        }
        print(f"  {mk:12} now {out[mk]['now']['range']}  past {out[mk]['past']['range']}")

    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} : {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()

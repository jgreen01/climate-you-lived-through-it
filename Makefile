# CS416 Narrative Visualization: dev workflow
# Site itself has zero build step; these targets are dev conveniences only.

PORT ?= 8000

# Vendored libraries, pinned and served from the jsDelivr npm CDN.
# D3: https://d3js.org  (npm: d3)
D3_URL         = https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js
# d3-svg-annotation by Susie Lu: https://d3-annotation.susielu.com  (npm: d3-svg-annotation)
ANNOTATION_URL = https://cdn.jsdelivr.net/npm/d3-svg-annotation@2.5.1/d3-annotation.min.js
# topojson-client: https://github.com/topojson/topojson-client  (npm: topojson-client)
TOPOJSON_URL   = https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js
# world-atlas basemap (Natural Earth as TopoJSON): https://github.com/topojson/world-atlas  (npm: world-atlas)
WORLDATLAS_URL = https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json

.PHONY: serve vendor test test-setup deploy data clean-vendor

## data: pre-bake heat data (downloads ~1.4GB NetCDF once into data/raw/)
data: .venv/bin/python
	.venv/bin/python prep_data.py

.venv/bin/python:
	python3 -m venv .venv
	.venv/bin/pip install --quiet netCDF4 numpy

## serve: run a local static webserver on http://localhost:$(PORT)
serve:
	python3 -m http.server $(PORT)

## vendor: (re-)download pinned vendor libraries into js/lib/
vendor:
	mkdir -p js/lib
	curl -sfLo js/lib/d3.v7.min.js $(D3_URL)
	curl -sfLo js/lib/d3-annotation.min.js $(ANNOTATION_URL)
	curl -sfLo js/lib/topojson-client.min.js $(TOPOJSON_URL)
	curl -sfLo js/lib/countries-110m.json $(WORLDATLAS_URL)
	@echo "--- vendored files ---"
	@ls -la js/lib/
	@head -c 80 js/lib/d3.v7.min.js; echo

## test-setup: one-time install of Playwright + Chromium
test-setup:
	npm install
	npx playwright install chromium

## test: run the Playwright test suite (starts its own server)
test:
	npx playwright test

## deploy: publish the site to static hosting (STUB: fill in once hosting is chosen)
# Site is fully static: index.html, css/, js/, data/ are everything that ships.
# Options: GitHub Pages (git push), rsync to a server, S3 sync, Netlify, etc.
deploy:
	@echo "TODO: deploy stub - choose static hosting and implement."
	@echo "Files to publish: index.html css/ js/ data/"
	@exit 1

clean-vendor:
	rm -f js/lib/*.js

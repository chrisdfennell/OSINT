# OSINT Hub

A self-hosted, map-centric intelligence dashboard that pulls live open data —
aircraft, ships, earthquakes, fires, weather radar, lightning, satellites,
geopolitical events, news — and overlays all of it on a single Leaflet map.
Plus a tools directory, live TV news grid, searchable geocoder, measure/draw
tool, and a shareable-URL state so you can send a link to what you're
looking at.

Runs in Docker. One `docker compose up` away.

## Quickstart

```sh
git clone <this repo>
cd OSINT
cp .env.example .env       # fill in any optional keys you have
docker compose up -d --build
```

Open http://localhost:3000 (or wherever you pointed the port at).

## Redeploying (SSH-friendly)

On a server, pull the latest source from GitHub and rebuild in one step:

```sh
./deploy.sh            # git pull + docker compose up -d --build
./deploy.sh --logs     # same, then tails container logs
./deploy.sh --no-pull  # rebuild without pulling (use local edits)
```

The script auto-detects `docker compose` vs legacy `docker-compose`, and
copies `.env.example` → `.env` on first run if you haven't yet.

Nothing in `.env` is strictly required — the app boots and works out of the
box. Keys unlock richer data for specific layers (see table below).

## Environment variables

| Variable            | Purpose                                      | Without it                              |
|---------------------|----------------------------------------------|-----------------------------------------|
| `AISSTREAM_API_KEY` | AIS ship tracking via aisstream.io           | Ship layer disabled                     |
| `OWM_API_KEY`       | OpenWeatherMap tiles (precip, wind, temp, clouds) | Falls back to RainViewer (lower zoom)   |
| `FR24_API_TOKEN`    | FR24 flight enrichment (route, airline, reg) | Aircraft still tracked via adsb.lol     |
| `YOUTUBE_API_KEY`   | Live viewer counts for the Hot Spots panel   | Hot Spots falls back to a static list   |
| `FIRMS_MAP_KEY`     | NASA FIRMS raw thermal hotspots (VIIRS)      | FIRMS layer stays empty (EONET still works) |
| `MAPILLARY_TOKEN`   | Mapillary access token for Ground View tool  | Ground View reports "not configured"    |
| `PORT`              | Server port                                  | Defaults to 3000                        |

All free tiers. Signup links are in `.env.example`.

## Layers

Organized in the sidebar under collapsible groups.

**Transit** — Aircraft (adsb.lol, optional FR24 enrichment), Ships (AIS)

**Natural Events** — Earthquakes (USGS), Fires (NASA EONET curated
wildfire events), **Thermal hotspots (NASA FIRMS VIIRS, raw per-pixel
detections, 24h rolling)**, Volcanoes (EONET), Tropical Cyclones (NHC),
Lightning (Blitzortung, live WebSocket bridged to SSE)

**Weather** — Precip Radar (OWM), Rain Radar (RainViewer), NEXRAD (Iowa
Environmental Mesonet), Satellite IR (OWM clouds / RainViewer), Wind Speed
(OWM), Temperature (OWM) — with legends

**Space** — ISS (live position + past trail + projected next-3-orbit
ground track via wheretheiss.at), Satellites (~148 bright sats propagated
client-side from Celestrak TLEs via satellite.js), Aurora (NOAA SWPC
Ovation + Kp index)

**Intel / Infrastructure** — GDELT geolocated events (15-min CSV export
parsed server-side), Air Quality (Open-Meteo air-quality model sampled at
~230 cities including every national capital), Submarine Cables
(TeleGeography GeoJSON), Power Plants (WRI Global Power Plant Database,
≥100 MW ≈ 10k plants colored by fuel), Live Webcams (curated 24/7 YouTube
cams with in-popup embeds)

**Hot Spots** (sidebar top) — dynamically sorted list of webcams, ranked
by concurrent YouTube viewers if `YOUTUBE_API_KEY` is set. Click to
fly-to + open the popup.

**OSINT Tools** — a set of pick-mode / analyst helpers:

- **Sun / Shadow** — click the map; popup shows sun azimuth, altitude,
  shadow direction, sunrise/sunset, and a draggable date/time control.
  Uses SunCalc.js. Core chronolocation / shadow-angle tool.
- **Ground View** — click the map; server queries Mapillary's Graph API
  for the closest street-level photo within ~200m. Thumbnail gallery in
  the popup with a link into Mapillary's viewer. Requires
  `MAPILLARY_TOKEN`.
- **AOI Watchboxes** — enable, then draw a polygon / rectangle / circle
  with the existing measure tool. While the watcher is on, every minute
  it checks earthquakes, EONET fires, FIRMS hotspots, and GDELT events
  against each box and raises a toast for each new event. Boxes persist
  to `localStorage`.
- **Sanctions check** — each ship popup has a "Check OpenSanctions"
  button that looks up the vessel by IMO → MMSI → name against
  api.opensanctions.org. Any hits render inline (dataset, topics,
  countries) with a link to the full OpenSanctions entity page.

## Other features

- **Place search** — Nominatim-backed geocoder in the header; Enter to
  jump, Esc to clear. Drops a marker with the full display name.
- **Measure + draw tool** — leaflet-geoman toolbar (top-left of the map).
  Polyline for distance, polygon for area, rectangle, circle, marker.
  Permanent labels show km/mi, m²/km², perimeter, circle radius.
- **URL state sharing** — the hash reflects map view, enabled layers, and
  base map. Copy the URL, paste it to a colleague, same view.
- **News ticker** — scrolling bar above the status bar aggregating RSS
  from BBC, Al Jazeera, NPR, Guardian, Reuters, AP. Hover to pause, click
  to open the source article.
- **Live News tab** — grid of 24/7 English YouTube news channels
  (Al Jazeera, France 24, DW, ABC, NBC, CBS, Bloomberg, WION, etc.).
- **Tools tab** — curated OSINT tool directory organized by category
  (geolocation, satellite imagery, cyber, public records, etc.).
- **Mobile polish** — responsive breakpoints at 900px and 600px; sidebar
  becomes a drawer, ticker hides on phones, header wraps.

## Architecture

Thin Node/Express server in [server.js](server.js) that:

- proxies or aggregates upstream data so the browser never has to deal
  with CORS, auth, or rate limits;
- caches expensive feeds (GDELT CSV, WRI power plants, submarine cables,
  RainViewer frames, ISS future track, air quality, YouTube viewer counts);
- maintains a persistent WebSocket to Blitzortung for lightning and
  AISStream for ships, bridging both to the browser.

Vanilla ES modules on the frontend (no build step) under [public/js](public/js),
one file per layer under [public/js/layers](public/js/layers). Leaflet
1.9 for mapping, satellite.js for orbital propagation, leaflet-geoman for
drawing, all loaded from CDN.

```
server.js                      — Express + all upstream proxies/caches
public/
  index.html                   — single-page shell
  css/{theme,main}.css         — dark theme + layout
  js/
    app.js                     — bootstrap, toggle wiring
    map.js                     — Leaflet map + base layers
    state.js                   — URL hash ↔ UI state sync
    sidebar.js                 — collapsible groups
    ticker.js                  — RSS news ticker
    search.js                  — Nominatim geocoder
    measure.js                 — leaflet-geoman wrapper
    hotspots.js                — dynamic Hot Spots panel
    layers/                    — one module per map layer
    data/                      — static data (tools, webcams, categories)
```

## Data sources & credits

| Source | Used for |
|---|---|
| [adsb.lol](https://adsb.lol) | Aircraft positions |
| [FR24 API](https://fr24api.flightradar24.com) | Aircraft route/registration enrichment |
| [AISStream.io](https://aisstream.io) | AIS ship tracking |
| [USGS](https://earthquake.usgs.gov) | Earthquakes |
| [NASA EONET](https://eonet.gsfc.nasa.gov) | Fires, volcanoes |
| [NHC / NOAA](https://www.nhc.noaa.gov) | Tropical cyclones |
| [Blitzortung](https://www.blitzortung.org) | Real-time lightning |
| [RainViewer](https://www.rainviewer.com) | Global precip radar + satellite IR |
| [OpenWeatherMap](https://openweathermap.org) | Precip/wind/temp/clouds tiles |
| [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu) | NEXRAD composite |
| [wheretheiss.at](https://wheretheiss.at) | ISS position + orbit propagation |
| [Celestrak](https://celestrak.org) | Satellite TLEs |
| [NOAA SWPC](https://www.swpc.noaa.gov) | Aurora oval + Kp index |
| [GDELT Project](https://gdeltproject.org) | Geolocated event feed |
| [Open-Meteo](https://open-meteo.com) | Air quality |
| [TeleGeography](https://www.submarinecablemap.com) | Submarine cables |
| [WRI Global Power Plant DB](https://github.com/wri/global-power-plant-database) | Power plants |
| [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) | Geocoding |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | Raw thermal hotspots (VIIRS SNPP NRT) |
| [Mapillary](https://www.mapillary.com) | Crowdsourced street-level imagery |
| [OpenSanctions](https://www.opensanctions.org) | Sanctions / PEP / watchlist entities |
| [SunCalc](https://github.com/mourner/suncalc) | Sun position math |
| [Carto / Esri / OSM](https://carto.com) | Base map tiles |

Respect each source's terms of use. This dashboard is for personal /
research / OSINT use; it is not a redistribution service.

## Tech

Node 20, Express 4, `ws`, `adm-zip`. Browser side: Leaflet 1.9,
satellite.js 5, leaflet-geoman 2.18, all via unpkg. No build step, no
framework.

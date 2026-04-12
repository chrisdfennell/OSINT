// AOI watchboxes. Turn any drawn polygon/rectangle/circle into a geofence.
// When the watcher is enabled, the module polls the feeds we care about
// (earthquakes, EONET fires, FIRMS hotspots, GDELT events) and raises a toast
// whenever a new event lands inside any watchbox. Shapes persist to
// localStorage so they survive a reload.
//
// Integration with the existing drawing tool (leaflet-geoman): we listen for
// pm:create / pm:edit / pm:remove on the map and, while watcher mode is on,
// style new shapes as watchboxes (red outline) and save them.

import { showToast } from './toast.js';

const STORAGE_KEY = 'osint.aoi.watchboxes.v1';
const POLL_INTERVAL = 60 * 1000;
const MAX_ALERTS_PER_TICK = 8;

let map;
let enabled = false;
let layerGroup; // holds all watchbox Leaflet layers
let watchboxes = []; // { id, layer, geojson }
let seenIds = new Set(); // event IDs we've already alerted on
let pollTimer = null;
let firstPoll = true;

const STYLE_WATCH = {
    color: '#ff4455',
    fillColor: '#ff4455',
    fillOpacity: 0.08,
    weight: 2,
    dashArray: '6,4',
};
const STYLE_DEFAULT = {
    color: '#00d4ff',
    fillColor: '#00d4ff',
    fillOpacity: 0.15,
    weight: 2,
    dashArray: null,
};

function uid() {
    return 'aoi_' + Math.random().toString(36).slice(2, 10);
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function save() {
    try {
        const out = watchboxes.map(w => ({ id: w.id, geojson: w.geojson }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch { /* quota, ignore */ }
}

// Point-in-polygon for a simple ring (lng/lat in degrees). Doesn't handle
// holes or multi-polygons, which is fine — users draw with geoman's simple
// polygon/rectangle tools.
function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function containsPoint(w, lat, lon) {
    const g = w.geojson.geometry;
    if (g.type === 'Polygon') {
        return pointInRing(lon, lat, g.coordinates[0]);
    }
    if (g.type === 'Point' && w.geojson.properties?.radiusMeters) {
        const [plon, plat] = g.coordinates;
        const R = 6378137;
        const dLat = (lat - plat) * Math.PI / 180;
        const dLon = (lon - plon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(plat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        return d <= w.geojson.properties.radiusMeters;
    }
    return false;
}

function layerToGeoJSON(layer) {
    const shape = layer.pm?.getShape?.();
    if (shape === 'Circle') {
        const c = layer.getLatLng();
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
            properties: { shape: 'Circle', radiusMeters: layer.getRadius() },
        };
    }
    const gj = layer.toGeoJSON();
    if (!gj.properties) gj.properties = {};
    gj.properties.shape = shape || gj.geometry.type;
    return gj;
}

function geoJSONToLayer(gj) {
    if (gj.properties?.shape === 'Circle' && gj.geometry.type === 'Point') {
        const [lon, lat] = gj.geometry.coordinates;
        return L.circle([lat, lon], {
            ...STYLE_WATCH,
            radius: gj.properties.radiusMeters || 1000,
        });
    }
    return L.geoJSON(gj, { style: STYLE_WATCH }).getLayers()[0];
}

function addWatchboxFromLayer(layer) {
    const gj = layerToGeoJSON(layer);
    if (!gj || !gj.geometry) return;
    const id = uid();

    // Restyle in place (geoman creates with the shared measure style).
    if (layer.setStyle) layer.setStyle(STYLE_WATCH);
    layer.bindTooltip('Watchbox', {
        permanent: true, direction: 'center', className: 'measure-label aoi-label',
    }).openTooltip();

    watchboxes.push({ id, layer, geojson: gj });
    layerGroup.addLayer(layer);
    save();
    showToast(`Watchbox added (${watchboxes.length} total)`, 'info');
}

function removeWatchboxByLayer(layer) {
    const i = watchboxes.findIndex(w => w.layer === layer);
    if (i === -1) return;
    watchboxes.splice(i, 1);
    if (layerGroup.hasLayer(layer)) layerGroup.removeLayer(layer);
    save();
}

function restore() {
    for (const entry of load()) {
        const layer = geoJSONToLayer(entry.geojson);
        if (!layer) continue;
        layer.bindTooltip('Watchbox', {
            permanent: true, direction: 'center', className: 'measure-label aoi-label',
        });
        watchboxes.push({ id: entry.id, layer, geojson: entry.geojson });
    }
}

// ── Event sources ──
// All three feeds already have server proxies; we piggyback on the same JSON.

async function pollEarthquakes(alerts) {
    try {
        const r = await fetch('/api/earthquakes');
        if (!r.ok) return;
        const d = await r.json();
        for (const f of d.features || []) {
            const id = `eq:${f.id}`;
            if (seenIds.has(id)) continue;
            const [lon, lat] = f.geometry?.coordinates || [];
            if (lat == null || lon == null) continue;
            for (const w of watchboxes) {
                if (containsPoint(w, lat, lon)) {
                    const mag = f.properties.mag?.toFixed(1);
                    alerts.push(`🌎 M${mag} quake — ${f.properties.place || 'unknown'}`);
                    break;
                }
            }
            seenIds.add(id);
        }
    } catch { /* ignore */ }
}

async function pollFires(alerts) {
    try {
        const r = await fetch('/api/fires');
        if (!r.ok) return;
        const d = await r.json();
        for (const e of d.events || []) {
            const id = `eonet:${e.id}`;
            if (seenIds.has(id)) continue;
            const geo = (e.geometry || [])[(e.geometry || []).length - 1];
            const [lon, lat] = geo?.coordinates || [];
            if (lat == null || lon == null) continue;
            for (const w of watchboxes) {
                if (containsPoint(w, lat, lon)) {
                    alerts.push(`🔥 Fire — ${e.title || 'wildfire'}`);
                    break;
                }
            }
            seenIds.add(id);
        }
    } catch { /* ignore */ }
}

async function pollGdelt(alerts) {
    try {
        const r = await fetch('/api/gdelt');
        if (!r.ok) return;
        const d = await r.json();
        for (const e of d.events || []) {
            const id = `gdelt:${e.id}`;
            if (seenIds.has(id)) continue;
            if (e.lat == null || e.lon == null) continue;
            for (const w of watchboxes) {
                if (containsPoint(w, e.lat, e.lon)) {
                    alerts.push(`📰 GDELT event — ${e.place || e.countryCode || ''}`.trim());
                    break;
                }
            }
            seenIds.add(id);
        }
    } catch { /* ignore */ }
}

async function pollFirms(alerts) {
    try {
        const r = await fetch('/api/firms');
        if (!r.ok) return;
        const d = await r.json();
        if (!d.active) return;
        for (const h of d.hotspots || []) {
            // Synthesize an ID since FIRMS rows have no stable ID.
            const id = `firms:${h.date}${h.time}:${h.lat.toFixed(3)},${h.lon.toFixed(3)}`;
            if (seenIds.has(id)) continue;
            for (const w of watchboxes) {
                if (containsPoint(w, h.lat, h.lon)) {
                    alerts.push(`🛰 Thermal hotspot — ${h.date} ${h.time} UTC`);
                    break;
                }
            }
            seenIds.add(id);
        }
    } catch { /* ignore */ }
}

async function poll() {
    if (!enabled || watchboxes.length === 0) return;
    const alerts = [];
    await Promise.allSettled([
        pollEarthquakes(alerts),
        pollFires(alerts),
        pollGdelt(alerts),
        pollFirms(alerts),
    ]);
    if (firstPoll) {
        // Don't fire alerts for everything already present when you first
        // enable the watcher — only for new events going forward.
        firstPoll = false;
        return;
    }
    if (alerts.length === 0) return;
    for (const a of alerts.slice(0, MAX_ALERTS_PER_TICK)) {
        showToast(a, 'warn');
    }
    if (alerts.length > MAX_ALERTS_PER_TICK) {
        showToast(`+${alerts.length - MAX_ALERTS_PER_TICK} more watchbox alerts suppressed`, 'info');
    }
    // Prevent seenIds from growing forever.
    if (seenIds.size > 20000) {
        const arr = Array.from(seenIds);
        seenIds = new Set(arr.slice(arr.length - 10000));
    }
}

function onCreate(e) {
    if (!enabled) return;
    // Skip shapes created by our own restore (they aren't touched by geoman).
    if (!e.layer?.pm) return;
    addWatchboxFromLayer(e.layer);
}

function onRemove(e) {
    if (!e.layer) return;
    removeWatchboxByLayer(e.layer);
}

export function initAoiTool(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();

    restore();

    map.on('pm:create', onCreate);
    map.on('pm:remove', onRemove);
    map.on('pm:edit', (e) => {
        const w = watchboxes.find(x => x.layer === e.layer);
        if (w) {
            w.geojson = layerToGeoJSON(e.layer);
            save();
        }
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        for (const w of watchboxes) {
            if (!layerGroup.hasLayer(w.layer)) layerGroup.addLayer(w.layer);
            if (w.layer.openTooltip) w.layer.openTooltip();
        }
        firstPoll = true;
        seenIds = new Set();
        poll();
        if (!pollTimer) pollTimer = setInterval(poll, POLL_INTERVAL);
        const count = watchboxes.length;
        showToast(
            count
                ? `AOI watcher ON — monitoring ${count} box${count === 1 ? '' : 'es'}`
                : 'AOI watcher ON — draw a polygon/rectangle/circle to start watching',
            'info',
        );
    } else {
        clearInterval(pollTimer);
        pollTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    }
}

export function getWatchboxes() {
    return watchboxes;
}

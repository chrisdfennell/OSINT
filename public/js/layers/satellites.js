// Visible-satellite layer. Server proxies Celestrak's "visual" TLE group
// (~148 bright sats). Client propagates positions locally with satellite.js
// every 3 seconds — no network calls after the initial TLE fetch.

import { showToast } from '../toast.js';

const TLE_URL = '/api/satellites/tle';
const TICK_MS = 3000;
const SAT_COLOR = '#ffaa33';

let map;
let layerGroup;
let enabled = false;
let tickTimer = null;
let satrecs = []; // [{ name, rec, marker }]

function propagateOne(entry, now, gmst) {
    const pos = window.satellite.propagate(entry.rec, now);
    if (!pos?.position) return null;
    const geo = window.satellite.eciToGeodetic(pos.position, gmst);
    const lat = window.satellite.degreesLat(geo.latitude);
    const lon = window.satellite.degreesLong(geo.longitude);
    const altKm = geo.height;
    return { lat, lon, altKm };
}

function tick() {
    if (!enabled || !satrecs.length) return;
    const now = new Date();
    const gmst = window.satellite.gstime(now);

    for (const entry of satrecs) {
        const p = propagateOne(entry, now, gmst);
        if (!p || !isFinite(p.lat) || !isFinite(p.lon)) continue;

        const ll = [p.lat, p.lon];
        if (!entry.marker) {
            entry.marker = L.circleMarker(ll, {
                radius: 3,
                color: SAT_COLOR,
                weight: 1,
                fillColor: SAT_COLOR,
                fillOpacity: 0.85,
                opacity: 0.9,
                interactive: true,
            }).bindPopup('', { maxWidth: 240 });
            layerGroup.addLayer(entry.marker);
        } else {
            entry.marker.setLatLng(ll);
        }
        entry.lastPos = p;
    }

    const count = satrecs.filter(s => s.marker).length;
    const el = document.getElementById('satellite-count');
    if (el) el.textContent = count;
}

function bindPopups() {
    for (const entry of satrecs) {
        if (!entry.marker) continue;
        entry.marker.off('popupopen');
        entry.marker.on('popupopen', () => {
            const p = entry.lastPos;
            const alt = p?.altKm != null ? `${p.altKm.toFixed(0)} km` : '—';
            const ll = p ? `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` : '—';
            entry.marker.setPopupContent(`
                <div class="popup-title" style="color:${SAT_COLOR}">${entry.name}</div>
                <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${alt}</span></div>
                <div class="popup-row"><span class="popup-label">Lat/Lon</span><span class="popup-value">${ll}</span></div>
                <div class="popup-row"><span class="popup-label">Source</span><span class="popup-value"><a href="https://celestrak.org/satcat/search.php?CATNR=${entry.catnr || ''}" target="_blank" rel="noopener" style="color:var(--accent)">Celestrak</a></span></div>
            `);
        });
    }
}

async function loadTle() {
    try {
        const res = await fetch(TLE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        satrecs = (data.sats || []).map(s => {
            const rec = window.satellite.twoline2satrec(s.l1, s.l2);
            const catnr = (s.l1 || '').slice(2, 7).trim();
            return { name: s.name, rec, catnr };
        });
        bindPopups();
    } catch (err) {
        console.warn('Satellite TLE load failed:', err.message);
        showToast('Satellite data unavailable', 'warn');
    }
}

export function initSatellitesLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        if (!window.satellite) {
            showToast('satellite.js not loaded', 'error');
            return;
        }
        layerGroup.addTo(map);
        if (!satrecs.length) loadTle().then(() => { tick(); bindPopups(); });
        else { tick(); bindPopups(); }
        if (!tickTimer) tickTimer = setInterval(tick, TICK_MS);
    } else {
        clearInterval(tickTimer);
        tickTimer = null;
        layerGroup.clearLayers();
        for (const entry of satrecs) entry.marker = null;
        const el = document.getElementById('satellite-count');
        if (el) el.textContent = '0';
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    }
}

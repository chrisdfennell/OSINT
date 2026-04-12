// Aurora oval from NOAA SWPC Ovation. Each point is a 1°×1° cell with a
// 0–100 probability; the server filters to lit cells. Drawn as small filled
// rectangles colored by intensity (green → bright lime). Also updates the
// Kp indicator badge next to the toggle.

import { showToast } from '../toast.js';

const FEED_URL = '/api/aurora';
const REFRESH_INTERVAL = 15 * 60 * 1000;

let map;
let layerGroup;
let refreshTimer;
let enabled = false;

function auroraColor(p) {
    if (p >= 75) return '#ff3399';
    if (p >= 50) return '#aaff44';
    if (p >= 25) return '#66ff66';
    if (p >= 10) return '#33cc66';
    return '#1b7a3a';
}

async function fetchAurora() {
    if (!enabled) return;
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const coords = data.coordinates || [];

        layerGroup.clearLayers();
        for (const [lonRaw, lat, prob] of coords) {
            // NOAA uses 0..360 longitude; convert to -180..180 for Leaflet.
            const lon = lonRaw > 180 ? lonRaw - 360 : lonRaw;
            const color = auroraColor(prob);
            const opacity = Math.min(0.75, 0.1 + prob / 120);

            const cell = L.rectangle(
                [[lat - 0.5, lon - 0.5], [lat + 0.5, lon + 0.5]],
                {
                    stroke: false,
                    fillColor: color,
                    fillOpacity: opacity,
                    interactive: false,
                }
            );
            layerGroup.addLayer(cell);
        }

        const kpEl = document.getElementById('aurora-kp');
        if (kpEl) {
            kpEl.textContent = data.kp ? `Kp ${data.kp.value.toFixed(1)}` : '--';
        }
    } catch (err) {
        console.warn('Aurora fetch failed:', err.message);
        showToast('Aurora forecast unavailable', 'warn');
    }
}

export function initAuroraLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchAurora();
        if (!refreshTimer) refreshTimer = setInterval(fetchAurora, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const kpEl = document.getElementById('aurora-kp');
        if (kpEl) kpEl.textContent = '--';
    }
}

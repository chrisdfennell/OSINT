// FIRMS raw thermal hotspots (NASA VIIRS SNPP / NOAA-20). Distinct from the
// EONET wildfire layer: FIRMS gives you every thermal-anomaly pixel within
// the last ~24h, not just curated wildfire events. Useful for spotting
// industrial incidents, gas flares, and thermal signatures around conflict
// zones that EONET would never catalogue.

import { showToast } from '../toast.js';

const REFRESH_INTERVAL = 5 * 60 * 1000;
const MOVE_DEBOUNCE = 600;

let map;
let layerGroup;
let canvasRenderer;
let refreshTimer;
let moveDebounceTimer;
let enabled = false;
let lastData = [];
let lastToastTs = 0;
let serverActive = null;

function confidenceColor(conf) {
    const s = (conf || '').toString().toLowerCase();
    if (s === 'h' || s === 'high' || parseFloat(s) >= 80) return '#ff2200';
    if (s === 'n' || s === 'nominal' || (parseFloat(s) >= 30 && parseFloat(s) < 80)) return '#ff8800';
    return '#ffcc33';
}

function ageMinutes(h) {
    if (!h.date || !h.time) return null;
    const padded = h.time.padStart(4, '0');
    const hh = padded.slice(0, 2), mm = padded.slice(2, 4);
    const d = new Date(`${h.date}T${hh}:${mm}:00Z`);
    if (isNaN(d)) return null;
    return (Date.now() - d.getTime()) / 60000;
}

function buildPopup(h) {
    const age = ageMinutes(h);
    const ageStr = age == null
        ? '—'
        : age < 60 ? `${Math.round(age)} min ago`
        : age < 1440 ? `${(age / 60).toFixed(1)} h ago`
        : `${(age / 1440).toFixed(1)} d ago`;

    const timeStr = h.time ? `${h.time.padStart(4, '0').slice(0, 2)}:${h.time.padStart(4, '0').slice(2, 4)} UTC` : '';

    return `
        <div class="popup-title" style="color:#ff4400">Thermal hotspot</div>
        <div class="popup-row"><span class="popup-label">Lat/Lon</span><span class="popup-value">${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}</span></div>
        <div class="popup-row"><span class="popup-label">Observed</span><span class="popup-value">${h.date} ${timeStr}</span></div>
        <div class="popup-row"><span class="popup-label">Age</span><span class="popup-value">${ageStr}</span></div>
        <div class="popup-row"><span class="popup-label">Brightness</span><span class="popup-value">${h.brightness ? h.brightness.toFixed(1) + ' K' : '—'}</span></div>
        <div class="popup-row"><span class="popup-label">FRP</span><span class="popup-value">${h.frp ? h.frp.toFixed(1) + ' MW' : '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Confidence</span><span class="popup-value">${h.confidence || '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Day/Night</span><span class="popup-value">${h.dn === 'D' ? 'Day' : h.dn === 'N' ? 'Night' : '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Source</span><span class="popup-value">NASA FIRMS (VIIRS)</span></div>
    `;
}

function renderViewport() {
    if (!layerGroup) return;
    const bounds = map.getBounds().pad(0.1);
    layerGroup.clearLayers();

    let count = 0;
    // Thin the display at low zooms to avoid swamping the canvas.
    const zoom = map.getZoom();
    const maxRender = zoom < 4 ? 2000 : zoom < 6 ? 6000 : 20000;
    const step = Math.max(1, Math.floor(lastData.length / maxRender));

    for (let i = 0; i < lastData.length; i += step) {
        const h = lastData[i];
        if (!bounds.contains([h.lat, h.lon])) continue;
        const m = L.circleMarker([h.lat, h.lon], {
            renderer: canvasRenderer,
            radius: zoom < 5 ? 2 : 3,
            fillColor: confidenceColor(h.confidence),
            fillOpacity: 0.85,
            weight: 0,
            stroke: false,
            interactive: true,
        }).bindPopup(buildPopup(h), { maxWidth: 260 });
        layerGroup.addLayer(m);
        count++;
    }

    const el = document.getElementById('firms-count');
    if (el) el.textContent = count.toLocaleString();
}

async function fetchFirms() {
    if (!enabled) return;
    try {
        const r = await fetch('/api/firms');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!data.active) {
            serverActive = false;
            if (Date.now() - lastToastTs > 60000) {
                showToast('FIRMS hotspots require FIRMS_MAP_KEY in .env', 'info');
                lastToastTs = Date.now();
            }
            return;
        }
        serverActive = true;
        lastData = data.hotspots || [];
        renderViewport();
    } catch (err) {
        console.warn('FIRMS fetch failed:', err.message);
    }
}

export function initFirmsLayer(leafletMap) {
    map = leafletMap;
    canvasRenderer = L.canvas({ padding: 0.5 });
    layerGroup = L.layerGroup();

    map.on('moveend zoomend', () => {
        if (!enabled) return;
        clearTimeout(moveDebounceTimer);
        moveDebounceTimer = setTimeout(renderViewport, MOVE_DEBOUNCE);
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchFirms();
        if (!refreshTimer) refreshTimer = setInterval(fetchFirms, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('firms-count');
        if (el) el.textContent = '0';
    }
}

// Exposed so the AOI watcher can poll current hotspots without re-fetching.
export function getHotspots() {
    return lastData;
}

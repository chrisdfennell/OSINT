// Fire/thermal hotspot layer
// Uses NASA EONET API (free, no key) for wildfire events
// Plus FIRMS open CSV data for active fire hotspots

import { showToast } from '../toast.js';

const EONET_URL = '/api/fires';
const FIRMS_CSV_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';
const REFRESH_INTERVAL = 300000; // 5 minutes

let map;
let layerGroup;
let refreshTimer;
let enabled = false;
let fireCount = 0;

function buildPopup(event) {
    const title = event.title || 'Wildfire';
    const sources = (event.sources || []).map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener" style="color:var(--accent)">${s.id}</a>`
    ).join(', ');
    const date = event.geometry?.[0]?.date
        ? new Date(event.geometry[0].date).toUTCString()
        : 'Unknown';

    return `
        <div class="popup-title" style="color:#ff4400">${title}</div>
        <div class="popup-row"><span class="popup-label">Date</span><span class="popup-value">${date}</span></div>
        ${sources ? `<div class="popup-row"><span class="popup-label">Sources</span><span class="popup-value">${sources}</span></div>` : ''}
    `;
}

async function fetchFires() {
    if (!enabled) return;

    try {
        const response = await fetch(EONET_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const events = data.events || [];

        layerGroup.clearLayers();
        let count = 0;

        for (const event of events) {
            const geometries = event.geometry || [];
            // Use the most recent geometry point
            const geo = geometries[geometries.length - 1];
            if (!geo || !geo.coordinates) continue;

            const lon = geo.coordinates[0];
            const lat = geo.coordinates[1];

            const circle = L.circleMarker([lat, lon], {
                radius: 6,
                fillColor: '#ff4400',
                fillOpacity: 0.6,
                color: '#ff6622',
                weight: 2,
                opacity: 0.8,
            }).bindPopup(buildPopup(event), { maxWidth: 280 });

            layerGroup.addLayer(circle);
            count++;
        }

        fireCount = count;
        const el = document.getElementById('fire-count');
        if (el) el.textContent = fireCount;

        const refreshEl = document.getElementById('refresh-fires');
        if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    } catch (err) {
        console.warn('Fire data fetch failed:', err.message);
        showToast('Fire data unavailable', 'warn');
    }
}

export function initFireLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchFires();
        refreshTimer = setInterval(fetchFires, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('fire-count');
        if (el) el.textContent = '0';
    }
}

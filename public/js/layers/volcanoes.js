// Volcano activity layer via NASA EONET (open events, category=volcanoes).

import { showToast } from '../toast.js';

const FEED_URL = '/api/volcanoes';
const REFRESH_INTERVAL = 30 * 60 * 1000;

let map;
let layerGroup;
let refreshTimer;
let enabled = false;
let volcanoCount = 0;

function buildPopup(event) {
    const title = event.title || 'Volcano';
    const sources = (event.sources || []).map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener" style="color:var(--accent)">${s.id}</a>`
    ).join(', ');
    const date = event.geometry?.[event.geometry.length - 1]?.date
        ? new Date(event.geometry[event.geometry.length - 1].date).toUTCString()
        : 'Unknown';

    return `
        <div class="popup-title" style="color:#ff6622">${title}</div>
        <div class="popup-row"><span class="popup-label">Last observed</span><span class="popup-value">${date}</span></div>
        ${sources ? `<div class="popup-row"><span class="popup-label">Sources</span><span class="popup-value">${sources}</span></div>` : ''}
    `;
}

async function fetchVolcanoes() {
    if (!enabled) return;
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const events = data.events || [];

        layerGroup.clearLayers();
        let count = 0;

        for (const event of events) {
            const geo = event.geometry?.[event.geometry.length - 1];
            if (!geo?.coordinates) continue;
            const lon = geo.coordinates[0];
            const lat = geo.coordinates[1];

            const marker = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'volcano-icon',
                    html: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 20l6-12 3 6 2-4 5 10z"/><circle cx="10" cy="4" r="1.2"/><circle cx="13" cy="6" r="0.9"/></svg>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 20],
                }),
            }).bindPopup(buildPopup(event), { maxWidth: 280 });

            layerGroup.addLayer(marker);
            count++;
        }

        volcanoCount = count;
        const el = document.getElementById('volcano-count');
        if (el) el.textContent = volcanoCount;

        const refreshEl = document.getElementById('refresh-volcanoes');
        if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    } catch (err) {
        console.warn('Volcano data fetch failed:', err.message);
        showToast('Volcano data unavailable', 'warn');
    }
}

export function initVolcanoLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchVolcanoes();
        if (!refreshTimer) refreshTimer = setInterval(fetchVolcanoes, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('volcano-count');
        if (el) el.textContent = '0';
    }
}

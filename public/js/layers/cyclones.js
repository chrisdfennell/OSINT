// Tropical cyclones via NHC CurrentStorms.json. Atlantic + Eastern/Central
// Pacific only (JTWC has no clean JSON feed). Off-season returns empty.

import { showToast } from '../toast.js';

const FEED_URL = '/api/cyclones';
const REFRESH_INTERVAL = 10 * 60 * 1000;

let map;
let layerGroup;
let refreshTimer;
let enabled = false;
let stormCount = 0;

function classColor(cls) {
    const c = (cls || '').toUpperCase();
    if (c === 'HU' || c === 'MH' || c === 'TY' || c === 'STY') return '#ff2244';
    if (c === 'TS') return '#ffaa00';
    if (c === 'TD') return '#66ccff';
    return '#cc88ff';
}

function classLabel(cls) {
    const c = (cls || '').toUpperCase();
    return ({
        'HU': 'Hurricane', 'MH': 'Major Hurricane', 'TS': 'Tropical Storm',
        'TD': 'Tropical Depression', 'TY': 'Typhoon', 'STY': 'Super Typhoon',
        'PT': 'Post-Tropical', 'SD': 'Subtropical Depression', 'SS': 'Subtropical Storm',
    })[c] || cls || 'Cyclone';
}

function buildPopup(s) {
    const cls = classLabel(s.classification);
    const winds = s.intensity ? `${s.intensity} kt` : '—';
    const pressure = s.pressure ? `${s.pressure} mb` : '—';
    const movement = s.movementDir != null && s.movementSpeed != null
        ? `${s.movementDir}° @ ${s.movementSpeed} kt` : '—';
    const updated = s.lastUpdate ? new Date(s.lastUpdate).toUTCString() : '—';
    const advLink = s.publicAdvisory?.url
        ? `<a href="${s.publicAdvisory.url}" target="_blank" rel="noopener" style="color:var(--accent)">Advisory ${s.publicAdvisory.advNum || ''}</a>`
        : '—';

    return `
        <div class="popup-title" style="color:${classColor(s.classification)}">${s.name} — ${cls}</div>
        <div class="popup-row"><span class="popup-label">Winds</span><span class="popup-value">${winds}</span></div>
        <div class="popup-row"><span class="popup-label">Pressure</span><span class="popup-value">${pressure}</span></div>
        <div class="popup-row"><span class="popup-label">Movement</span><span class="popup-value">${movement}</span></div>
        <div class="popup-row"><span class="popup-label">Updated</span><span class="popup-value">${updated}</span></div>
        <div class="popup-row"><span class="popup-label">NHC</span><span class="popup-value">${advLink}</span></div>
    `;
}

async function fetchStorms() {
    if (!enabled) return;
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const storms = data.activeStorms || [];

        layerGroup.clearLayers();
        let count = 0;

        for (const s of storms) {
            const lat = s.latitudeNumeric;
            const lon = s.longitudeNumeric;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;

            const color = classColor(s.classification);
            const intensity = parseFloat(s.intensity) || 0;
            const radius = Math.max(10, Math.min(26, 10 + intensity / 5));

            // Outer ring sized roughly by sustained wind intensity.
            const ring = L.circleMarker([lat, lon], {
                radius,
                color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2,
                opacity: 0.9,
            }).bindPopup(buildPopup(s), { maxWidth: 300 });

            // Center dot + wind-driven arrow if movement direction known.
            const center = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'cyclone-icon',
                    html: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${s.movementDir || 0}deg)">
                        <circle cx="12" cy="12" r="3" fill="${color}"/>
                        <path d="M12 12 Q 20 6, 22 14" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
                        <path d="M12 12 Q 4 18, 2 10" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
                    </svg>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                }),
            }).bindPopup(buildPopup(s), { maxWidth: 300 });

            layerGroup.addLayer(ring);
            layerGroup.addLayer(center);
            count++;
        }

        stormCount = count;
        const el = document.getElementById('cyclone-count');
        if (el) el.textContent = stormCount;
    } catch (err) {
        console.warn('Cyclone data fetch failed:', err.message);
        showToast('Cyclone data unavailable', 'warn');
    }
}

export function initCycloneLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchStorms();
        if (!refreshTimer) refreshTimer = setInterval(fetchStorms, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('cyclone-count');
        if (el) el.textContent = '0';
    }
}

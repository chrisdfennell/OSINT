// Earthquake layer using USGS GeoJSON feed
// Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const REFRESH_INTERVAL = 120000; // 2 minutes

let layerGroup;
let refreshTimer;
let map;
let enabled = true;
let quakeCount = 0;

function magnitudeToRadius(mag) {
    if (mag < 3) return 6;
    if (mag < 4) return 10;
    if (mag < 5) return 16;
    if (mag < 6) return 24;
    if (mag < 7) return 34;
    return 46;
}

function magnitudeToColor(mag) {
    if (mag < 3) return '#44cc88';
    if (mag < 4) return '#ffcc00';
    if (mag < 5) return '#ff8800';
    if (mag < 6) return '#ff4444';
    if (mag < 7) return '#cc0000';
    return '#880044';
}

function depthLabel(depth) {
    if (depth < 10) return 'Shallow';
    if (depth < 70) return 'Intermediate';
    if (depth < 300) return 'Deep';
    return 'Very Deep';
}

function buildPopup(feature) {
    const p = feature.properties;
    const coords = feature.geometry.coordinates;
    const mag = p.mag;
    const place = p.place || 'Unknown location';
    const time = new Date(p.time).toUTCString();
    const depth = coords[2];
    const url = p.url;
    const tsunami = p.tsunami ? 'Yes' : 'No';
    const felt = p.felt ? `${p.felt} reports` : 'None';

    return `
        <div class="popup-title" style="color:${magnitudeToColor(mag)}">M${mag.toFixed(1)} - ${place}</div>
        <div class="popup-row"><span class="popup-label">Time (UTC)</span><span class="popup-value">${time}</span></div>
        <div class="popup-row"><span class="popup-label">Depth</span><span class="popup-value">${depth.toFixed(1)} km (${depthLabel(depth)})</span></div>
        <div class="popup-row"><span class="popup-label">Tsunami</span><span class="popup-value">${tsunami}</span></div>
        <div class="popup-row"><span class="popup-label">Felt</span><span class="popup-value">${felt}</span></div>
        <div class="popup-row"><span class="popup-label">Details</span><span class="popup-value"><a href="${url}" target="_blank" rel="noopener" style="color:var(--accent)">USGS Page</a></span></div>
    `;
}

async function fetchEarthquakes() {
    if (!enabled) return;

    try {
        const response = await fetch(FEED_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const features = data.features || [];

        layerGroup.clearLayers();

        for (const feature of features) {
            const coords = feature.geometry.coordinates;
            const lat = coords[1];
            const lon = coords[0];
            const mag = feature.properties.mag || 0;

            const radius = magnitudeToRadius(mag);
            const color = magnitudeToColor(mag);

            const circle = L.circleMarker([lat, lon], {
                radius: radius / 2,
                fillColor: color,
                fillOpacity: 0.4,
                color: color,
                weight: 2,
                opacity: 0.8,
                className: 'quake-marker',
            }).bindPopup(buildPopup(feature), { maxWidth: 300 });

            layerGroup.addLayer(circle);
        }

        quakeCount = features.length;
        const el = document.getElementById('quake-count');
        if (el) el.textContent = quakeCount;

        const refreshEl = document.getElementById('refresh-quakes');
        if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    } catch (err) {
        console.warn('Earthquake data fetch failed:', err.message);
    }
}

export function initEarthquakeLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup().addTo(map);

    fetchEarthquakes();
    refreshTimer = setInterval(fetchEarthquakes, REFRESH_INTERVAL);
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchEarthquakes();
        refreshTimer = setInterval(fetchEarthquakes, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        map.removeLayer(layerGroup);
    }
}

// Air quality layer: circles colored by US AQI at ~100 major cities. Server
// samples Open-Meteo's AQ model every 30 min (no API key). Not real station
// data — it's gridded model output with station-like resolution.

import { showToast } from '../toast.js';

const FEED_URL = '/api/airquality';
const REFRESH_INTERVAL = 30 * 60 * 1000;

let map;
let layerGroup;
let refreshTimer;
let enabled = false;

function aqiColor(cat) {
    return ({
        good: '#00e400',
        moderate: '#ffff00',
        sensitive: '#ff7e00',
        unhealthy: '#ff0000',
        'very-unhealthy': '#8f3f97',
        hazardous: '#7e0023',
    })[cat] || '#999';
}

function aqiLabel(cat) {
    return ({
        good: 'Good',
        moderate: 'Moderate',
        sensitive: 'Unhealthy (Sensitive)',
        unhealthy: 'Unhealthy',
        'very-unhealthy': 'Very Unhealthy',
        hazardous: 'Hazardous',
    })[cat] || 'Unknown';
}

function buildPopup(s) {
    const pm = s.pm25 != null ? `${s.pm25.toFixed(1)} µg/m³` : '—';
    const aqi = s.aqi != null ? s.aqi : '—';
    return `
        <div class="popup-title" style="color:${aqiColor(s.category)}">${s.name}</div>
        <div class="popup-row"><span class="popup-label">US AQI</span><span class="popup-value">${aqi} (${aqiLabel(s.category)})</span></div>
        <div class="popup-row"><span class="popup-label">PM2.5</span><span class="popup-value">${pm}</span></div>
        <div class="popup-row"><span class="popup-label">Model</span><span class="popup-value">Open-Meteo CAMS</span></div>
    `;
}

async function fetchStations() {
    if (!enabled) return;
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const stations = data.stations || [];

        layerGroup.clearLayers();
        for (const s of stations) {
            const color = aqiColor(s.category);
            const circle = L.circleMarker([s.lat, s.lon], {
                radius: 7,
                fillColor: color,
                fillOpacity: 0.75,
                color: '#ffffff',
                weight: 1,
                opacity: 0.9,
            }).bindPopup(buildPopup(s), { maxWidth: 280 });
            layerGroup.addLayer(circle);
        }

        const el = document.getElementById('airquality-count');
        if (el) el.textContent = stations.length;
    } catch (err) {
        console.warn('Air quality fetch failed:', err.message);
        showToast('Air quality unavailable', 'warn');
    }
}

export function initAirQualityLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchStations();
        if (!refreshTimer) refreshTimer = setInterval(fetchStations, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('airquality-count');
        if (el) el.textContent = '0';
    }
}

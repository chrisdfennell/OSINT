// Weather tile layers - all free, no API keys needed
//
// RainViewer: precipitation radar + satellite/infrared imagery
//   Docs: https://www.rainviewer.com/api.html
//   Completely free, no registration
//
// OpenWeatherMap: wind, temp, clouds, pressure tiles
//   Free tier: 1000 calls/day, requires free API key
//   We use a placeholder - users can add their own key

import { showToast } from '../toast.js';

const RAINVIEWER_API = '/api/weather/rainviewer';

let map;
let radarLayer = null;
let satelliteLayer = null;
let windLayer = null;
let tempLayer = null;
let rainviewerData = null;
let radarReady = false;

// ── RainViewer (free, no key) ──

async function loadRainViewerData() {
    try {
        const response = await fetch(RAINVIEWER_API);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rainviewerData = await response.json();
        radarReady = true;

        // Build layers from latest timestamps
        const radarTimes = rainviewerData.radar?.past || [];
        const satTimes = rainviewerData.satellite?.infrared || [];

        if (radarTimes.length > 0) {
            const latest = radarTimes[radarTimes.length - 1];
            radarLayer = L.tileLayer(
                `${rainviewerData.host}${latest.path}/256/{z}/{x}/{y}/6/1_1.png`,
                {
                    opacity: 0.65,
                    maxZoom: 18,
                    zIndex: 100,
                    attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
                }
            );
        }

        if (satTimes.length > 0) {
            const latest = satTimes[satTimes.length - 1];
            satelliteLayer = L.tileLayer(
                `${rainviewerData.host}${latest.path}/256/{z}/{x}/{y}/0/0_0.png`,
                {
                    opacity: 0.5,
                    maxZoom: 18,
                    zIndex: 99,
                    attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
                }
            );
        }
    } catch (err) {
        console.warn('RainViewer data load failed:', err.message);
        showToast('Weather radar unavailable', 'warn');
    }
}

// Refresh RainViewer data every 5 minutes (new radar frames)
function startRainViewerRefresh() {
    setInterval(async () => {
        const wasRadarOn = radarLayer && map.hasLayer(radarLayer);
        const wasSatOn = satelliteLayer && map.hasLayer(satelliteLayer);

        // Remove old layers
        if (radarLayer && map.hasLayer(radarLayer)) map.removeLayer(radarLayer);
        if (satelliteLayer && map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);

        // Reload data and rebuild layers
        await loadRainViewerData();

        // Re-add if they were enabled
        if (wasRadarOn && radarLayer) radarLayer.addTo(map);
        if (wasSatOn && satelliteLayer) satelliteLayer.addTo(map);
    }, 300000);
}

// ── Wind & Temperature (using free tile sources) ──
// Using OpenWeatherMap-compatible free tiles from open sources

function createWindLayer() {
    // Use a proxy-free wind tile source
    // Windy tiles aren't directly available, but we can use OWM free tier
    // For now, show a message that this needs an OWM API key
    // Users can get one free at https://openweathermap.org/api
    return null;
}

function createTempLayer() {
    return null;
}

// ── Exports ──

export function initWeatherLayers(leafletMap) {
    map = leafletMap;
    loadRainViewerData();
    startRainViewerRefresh();
}

export function setRadarEnabled(on) {
    if (on) {
        if (radarLayer) {
            radarLayer.addTo(map);
        } else if (!radarReady) {
            // Data hasn't loaded yet - wait and retry
            const check = setInterval(() => {
                if (radarLayer) {
                    radarLayer.addTo(map);
                    clearInterval(check);
                }
            }, 500);
            // Give up after 10 seconds
            setTimeout(() => clearInterval(check), 10000);
        }
    } else if (radarLayer && map.hasLayer(radarLayer)) {
        map.removeLayer(radarLayer);
    }
}

export function setCloudsEnabled(on) {
    // Clouds = satellite infrared from RainViewer
    if (on) {
        if (satelliteLayer) {
            satelliteLayer.addTo(map);
        } else if (!radarReady) {
            const check = setInterval(() => {
                if (satelliteLayer) {
                    satelliteLayer.addTo(map);
                    clearInterval(check);
                }
            }, 500);
            setTimeout(() => clearInterval(check), 10000);
        }
    } else if (satelliteLayer && map.hasLayer(satelliteLayer)) {
        map.removeLayer(satelliteLayer);
    }
}

export function setWindEnabled(on) {
    if (on && !windLayer) {
        showToast('Wind layer requires an OpenWeatherMap API key', 'info');
    }
    if (on && windLayer) {
        windLayer.addTo(map);
    } else if (windLayer && map.hasLayer(windLayer)) {
        map.removeLayer(windLayer);
    }
}

export function setTempEnabled(on) {
    if (on && !tempLayer) {
        showToast('Temperature layer requires an OpenWeatherMap API key', 'info');
    }
    if (on && tempLayer) {
        tempLayer.addTo(map);
    } else if (tempLayer && map.hasLayer(tempLayer)) {
        map.removeLayer(tempLayer);
    }
}

// Allow users to set an OWM API key at runtime
export function setOWMKey(apiKey) {
    if (!apiKey) return;

    windLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        { opacity: 0.5, maxZoom: 18, maxNativeZoom: 6, zIndex: 98 }
    );

    tempLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        { opacity: 0.5, maxZoom: 18, maxNativeZoom: 6, zIndex: 97 }
    );
}

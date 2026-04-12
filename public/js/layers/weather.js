// Weather tile layers.
//
// Global precip radar: OpenWeatherMap precipitation (zoom 18, needs key) when
//   available, falls back to RainViewer (key-free, zoom-limited).
// US precip radar: NEXRAD composite via Iowa Environmental Mesonet (high-res,
//   US only, key-free, zoom 18).
// Satellite/infrared clouds: RainViewer.
// Wind/temperature: OpenWeatherMap.

import { showToast } from '../toast.js';

const RAINVIEWER_API = '/api/weather/rainviewer';

let map;
let rainviewerRadarLayer = null;
let owmRadarLayer = null;
let nexradLayer = null;
let rainviewerSatLayer = null;
let owmCloudsLayer = null;
let windLayer = null;
let tempLayer = null;
let rainviewerData = null;
let radarReady = false;

function activeRadar() {
    return owmRadarLayer || rainviewerRadarLayer;
}

// RainViewer's satellite.infrared array is frequently empty now, so prefer the
// OWM clouds layer when the key is present.
function activeClouds() {
    return owmCloudsLayer || rainviewerSatLayer;
}

// ── RainViewer (free, no key) ──

async function loadRainViewerData() {
    try {
        const response = await fetch(RAINVIEWER_API);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rainviewerData = await response.json();
        radarReady = true;

        const radarTimes = rainviewerData.radar?.past || [];
        const satTimes = rainviewerData.satellite?.infrared || [];

        // 256-size tiles return a "Zoom Level Not Supported" placeholder above z7; 512 covers higher.
        if (radarTimes.length > 0) {
            const latest = radarTimes[radarTimes.length - 1];
            rainviewerRadarLayer = L.tileLayer(
                `${rainviewerData.host}${latest.path}/512/{z}/{x}/{y}/6/1_1.png`,
                {
                    tileSize: 512,
                    zoomOffset: -1,
                    opacity: 0.65,
                    maxZoom: 18,
                    maxNativeZoom: 10,
                    zIndex: 100,
                    attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
                }
            );
        }

        if (satTimes.length > 0) {
            const latest = satTimes[satTimes.length - 1];
            rainviewerSatLayer = L.tileLayer(
                `${rainviewerData.host}${latest.path}/512/{z}/{x}/{y}/0/0_0.png`,
                {
                    tileSize: 512,
                    zoomOffset: -1,
                    opacity: 0.5,
                    maxZoom: 18,
                    maxNativeZoom: 10,
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

// Refresh RainViewer frames every 5 min. Only touches layers it owns;
// OWM radar (if active) is untouched.
function startRainViewerRefresh() {
    setInterval(async () => {
        const wasRVRadarOn = rainviewerRadarLayer && map.hasLayer(rainviewerRadarLayer);
        const wasRVSatOn = rainviewerSatLayer && map.hasLayer(rainviewerSatLayer);

        if (wasRVRadarOn) map.removeLayer(rainviewerRadarLayer);
        if (wasRVSatOn) map.removeLayer(rainviewerSatLayer);

        await loadRainViewerData();

        if (wasRVRadarOn && rainviewerRadarLayer) rainviewerRadarLayer.addTo(map);
        if (wasRVSatOn && rainviewerSatLayer) rainviewerSatLayer.addTo(map);
    }, 300000);
}

// ── Exports ──

export function initWeatherLayers(leafletMap) {
    map = leafletMap;
    loadRainViewerData();
    startRainViewerRefresh();

    nexradLayer = L.tileLayer(
        'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
        {
            opacity: 0.35,
            maxZoom: 18,
            zIndex: 101,
            attribution: '<a href="https://mesonet.agron.iastate.edu/">NEXRAD via IEM</a>',
        }
    );
}

export function setNexradEnabled(on) {
    if (!nexradLayer) return;
    if (on) {
        nexradLayer.addTo(map);
    } else if (map.hasLayer(nexradLayer)) {
        map.removeLayer(nexradLayer);
    }
}

export function setRadarEnabled(on) {
    if (on) {
        const layer = activeRadar();
        if (layer) {
            layer.addTo(map);
        } else if (!radarReady) {
            const check = setInterval(() => {
                const l = activeRadar();
                if (l) {
                    l.addTo(map);
                    clearInterval(check);
                }
            }, 500);
            setTimeout(() => clearInterval(check), 10000);
        }
    } else {
        if (owmRadarLayer && map.hasLayer(owmRadarLayer)) map.removeLayer(owmRadarLayer);
        // Only remove the RainViewer layer if it's acting as the OWM fallback
        // (i.e. no OWM layer exists). Otherwise leave it alone so the dedicated
        // Rain Radar toggle controls it independently.
        if (!owmRadarLayer && rainviewerRadarLayer && map.hasLayer(rainviewerRadarLayer)) {
            map.removeLayer(rainviewerRadarLayer);
        }
    }
}

// Dedicated RainViewer toggle — independent of Precip Radar.
export function setRainViewerEnabled(on) {
    if (on) {
        if (rainviewerRadarLayer) {
            rainviewerRadarLayer.addTo(map);
        } else {
            const check = setInterval(() => {
                if (rainviewerRadarLayer) {
                    rainviewerRadarLayer.addTo(map);
                    clearInterval(check);
                }
            }, 500);
            setTimeout(() => clearInterval(check), 10000);
        }
    } else if (rainviewerRadarLayer && map.hasLayer(rainviewerRadarLayer)) {
        map.removeLayer(rainviewerRadarLayer);
    }
}

export function setCloudsEnabled(on) {
    if (on) {
        const layer = activeClouds();
        if (layer) {
            layer.addTo(map);
        } else if (!radarReady) {
            const check = setInterval(() => {
                const l = activeClouds();
                if (l) {
                    l.addTo(map);
                    clearInterval(check);
                }
            }, 500);
            setTimeout(() => clearInterval(check), 10000);
        } else {
            showToast('Cloud imagery unavailable', 'warn');
        }
    } else {
        if (owmCloudsLayer && map.hasLayer(owmCloudsLayer)) map.removeLayer(owmCloudsLayer);
        if (rainviewerSatLayer && map.hasLayer(rainviewerSatLayer)) map.removeLayer(rainviewerSatLayer);
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

export function setOWMKey(apiKey) {
    if (!apiKey) return;

    // Swap any active RainViewer radar for the higher-zoom OWM version.
    const radarWasOn = rainviewerRadarLayer && map && map.hasLayer(rainviewerRadarLayer);
    if (radarWasOn) map.removeLayer(rainviewerRadarLayer);

    owmRadarLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        {
            opacity: 0.65,
            maxZoom: 18,
            zIndex: 100,
            attribution: '<a href="https://openweathermap.org/">OpenWeatherMap</a>',
        }
    );
    radarReady = true;

    if (radarWasOn) owmRadarLayer.addTo(map);

    const cloudsWasOn = rainviewerSatLayer && map && map.hasLayer(rainviewerSatLayer);
    if (cloudsWasOn) map.removeLayer(rainviewerSatLayer);

    owmCloudsLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        {
            opacity: 0.55,
            maxZoom: 18,
            zIndex: 99,
            attribution: '<a href="https://openweathermap.org/">OpenWeatherMap</a>',
        }
    );

    if (cloudsWasOn) owmCloudsLayer.addTo(map);

    windLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        { opacity: 0.5, maxZoom: 18, maxNativeZoom: 6, zIndex: 98 }
    );

    tempLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        { opacity: 0.5, maxZoom: 18, maxNativeZoom: 6, zIndex: 97 }
    );
}

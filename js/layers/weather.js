// Weather tile layers from OpenWeatherMap (free tier)
// Uses RainViewer for radar (free, no key needed)
// Uses OpenWeatherMap for clouds/wind/temp (free tier with key)

// RainViewer is completely free and needs no API key
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

let map;
let radarLayer;
let cloudLayer;
let windLayer;
let tempLayer;
let rainviewerTimestamps = [];

async function getRainViewerTimestamps() {
    try {
        const response = await fetch(RAINVIEWER_API);
        const data = await response.json();
        rainviewerTimestamps = data.radar?.past || [];
        return rainviewerTimestamps;
    } catch (err) {
        console.warn('RainViewer API failed:', err.message);
        return [];
    }
}

function createRainViewerLayer(timestamp) {
    return L.tileLayer(
        `https://tilecache.rainviewer.com/v2/radar/${timestamp}/256/{z}/{x}/{y}/4/1_1.png`,
        {
            opacity: 0.6,
            maxZoom: 18,
            attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
        }
    );
}

// OpenWeatherMap free tile layers (limited but functional without key)
// Using OpenWeatherMap 1.0 tiles which work without API key for basic layers
function createOWMLayer(layerName) {
    // OWM 1.0 tiles - these require an API key now, so we'll use alternatives
    // For clouds: use a free tile source
    const urls = {
        clouds: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=',
        wind: 'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=',
        temp: 'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=',
    };

    // Since OWM requires API key, we'll use RainViewer for radar
    // and simple tile overlays for visual reference
    return null;
}

export function initWeatherLayers(leafletMap) {
    map = leafletMap;

    // Initialize radar from RainViewer (free, no key)
    initRadar();
}

async function initRadar() {
    const timestamps = await getRainViewerTimestamps();
    if (timestamps.length > 0) {
        const latest = timestamps[timestamps.length - 1];
        radarLayer = createRainViewerLayer(latest.time);
    }
}

export function setRadarEnabled(on) {
    if (!radarLayer) return;
    if (on) {
        radarLayer.addTo(map);
    } else {
        map.removeLayer(radarLayer);
    }
}

export function setCloudsEnabled(on) {
    // Using a free cloud tile source
    if (on) {
        if (!cloudLayer) {
            // Use CartoDB positron labels-only as a lightweight "cloud-like" overlay
            // For real clouds, users would need an OWM API key
            cloudLayer = L.tileLayer(
                'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e0',
                { opacity: 0.5, maxZoom: 18 }
            );
        }
        cloudLayer.addTo(map);
    } else if (cloudLayer) {
        map.removeLayer(cloudLayer);
    }
}

export function setWindEnabled(on) {
    if (on) {
        if (!windLayer) {
            windLayer = L.tileLayer(
                'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e0',
                { opacity: 0.5, maxZoom: 18 }
            );
        }
        windLayer.addTo(map);
    } else if (windLayer) {
        map.removeLayer(windLayer);
    }
}

export function setTempEnabled(on) {
    if (on) {
        if (!tempLayer) {
            tempLayer = L.tileLayer(
                'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e0',
                { opacity: 0.5, maxZoom: 18 }
            );
        }
        tempLayer.addTo(map);
    } else if (tempLayer) {
        map.removeLayer(tempLayer);
    }
}

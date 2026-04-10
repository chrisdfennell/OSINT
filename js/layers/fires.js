// Fire detection layer using NASA FIRMS
// Uses the open CSV/JSON endpoint for active fires (last 24h)
// https://firms.modaps.eosdis.nasa.gov/api/

// FIRMS provides free data via their map API - we can use their WMS/tile service
const FIRMS_WMS_URL = 'https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/';
// Alternative: Use FIRMS GeoJSON endpoint (requires free API key for full data)
// For now, use their WMS tile overlay which is free

let map;
let fireLayer;
let enabled = false;
let fireCount = 0;

export function initFireLayer(leafletMap) {
    map = leafletMap;

    // Use FIRMS WMS as a tile layer overlay
    fireLayer = L.tileLayer.wms(FIRMS_WMS_URL, {
        layers: 'fires_modis_24',
        format: 'image/png',
        transparent: true,
        opacity: 0.7,
        maxZoom: 18,
        attribution: '<a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>',
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        fireLayer.addTo(map);
        // WMS doesn't give us a count, but we show that it's active
        const el = document.getElementById('fire-count');
        if (el) el.textContent = 'ON';
        const refreshEl = document.getElementById('refresh-fires');
        if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    } else {
        map.removeLayer(fireLayer);
        const el = document.getElementById('fire-count');
        if (el) el.textContent = '0';
    }
}

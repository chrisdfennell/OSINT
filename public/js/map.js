// Core map module - Leaflet setup and base map management

let map;
const baseMaps = {};

const TILE_URLS = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    streets: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

const TILE_ATTR = {
    dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    satellite: '&copy; <a href="https://www.esri.com/">Esri</a>',
    streets: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
};

export function initMap() {
    map = L.map('map', {
        center: [30, 0],
        zoom: 3,
        zoomControl: true,
        attributionControl: true,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
    });

    // Create base layers
    for (const [name, url] of Object.entries(TILE_URLS)) {
        baseMaps[name] = L.tileLayer(url, {
            attribution: TILE_ATTR[name],
            maxZoom: 19,
            subdomains: 'abcd',
        });
    }

    // Default to dark
    baseMaps.dark.addTo(map);

    // Status bar: show coords on mouse move
    map.on('mousemove', (e) => {
        const el = document.getElementById('status-coords');
        if (el) {
            el.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        }
    });

    map.on('zoomend', () => {
        const el = document.getElementById('status-zoom');
        if (el) {
            el.textContent = `Zoom: ${map.getZoom()}`;
        }
    });

    // Fire initial zoom display
    const zoomEl = document.getElementById('status-zoom');
    if (zoomEl) zoomEl.textContent = `Zoom: ${map.getZoom()}`;

    return map;
}

export function getMap() {
    return map;
}

export function setBaseMap(name) {
    for (const [key, layer] of Object.entries(baseMaps)) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    }
    if (baseMaps[name]) {
        baseMaps[name].addTo(map);
    }
}

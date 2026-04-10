// Flight tracking layer using OpenSky Network API
// API docs: https://openskynetwork.github.io/opensky-api/rest.html

const API_URL = 'https://opensky-network.org/api/states/all';
const REFRESH_INTERVAL = 15000; // 15 seconds (API rate limit: 10s anonymous)

let layerGroup;
let refreshTimer;
let map;
let enabled = true;
let aircraftCount = 0;

// SVG airplane icon pointing up (north) - rotated per heading
function createAircraftIcon(heading, onGround) {
    const color = onGround ? '#666' : '#00d4ff';
    const rotation = heading || 0;

    return L.divIcon({
        className: 'aircraft-icon',
        html: `<svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg);color:${color}" fill="currentColor">
            <path d="M12 2L8 10H3l2 4-3 6h5l5 2 5-2h5l-3-6 2-4h-5L12 2z"/>
        </svg>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
}

function formatAltitude(meters) {
    if (meters == null) return 'N/A';
    const feet = Math.round(meters * 3.28084);
    return `${feet.toLocaleString()} ft`;
}

function formatSpeed(ms) {
    if (ms == null) return 'N/A';
    const knots = Math.round(ms * 1.94384);
    return `${knots} kts`;
}

function buildPopup(state) {
    const callsign = (state[1] || '').trim() || 'Unknown';
    const origin = state[2] || 'Unknown';
    const altitude = formatAltitude(state[7] || state[13]);
    const speed = formatSpeed(state[9]);
    const heading = state[10] != null ? `${Math.round(state[10])}°` : 'N/A';
    const vrate = state[11] != null ? `${Math.round(state[11] * 196.85)} ft/min` : 'N/A';
    const onGround = state[8] ? 'Yes' : 'No';
    const icao24 = state[0];

    return `
        <div class="popup-title">${callsign}</div>
        <div class="popup-row"><span class="popup-label">ICAO24</span><span class="popup-value">${icao24}</span></div>
        <div class="popup-row"><span class="popup-label">Origin</span><span class="popup-value">${origin}</span></div>
        <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${altitude}</span></div>
        <div class="popup-row"><span class="popup-label">Speed</span><span class="popup-value">${speed}</span></div>
        <div class="popup-row"><span class="popup-label">Heading</span><span class="popup-value">${heading}</span></div>
        <div class="popup-row"><span class="popup-label">Vert Rate</span><span class="popup-value">${vrate}</span></div>
        <div class="popup-row"><span class="popup-label">On Ground</span><span class="popup-value">${onGround}</span></div>
    `;
}

async function fetchFlights() {
    if (!enabled) return;

    try {
        // Only fetch what's visible on the map to reduce data
        const bounds = map.getBounds();
        const params = new URLSearchParams({
            lamin: bounds.getSouth().toFixed(2),
            lomin: bounds.getWest().toFixed(2),
            lamax: bounds.getNorth().toFixed(2),
            lomax: bounds.getEast().toFixed(2),
        });

        const response = await fetch(`${API_URL}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const states = data.states || [];

        // Clear existing markers
        layerGroup.clearLayers();

        // Add new markers
        let count = 0;
        for (const state of states) {
            const lat = state[6];
            const lon = state[5];
            if (lat == null || lon == null) continue;

            const heading = state[10];
            const onGround = state[8];
            const icon = createAircraftIcon(heading, onGround);

            const marker = L.marker([lat, lon], { icon })
                .bindPopup(buildPopup(state), { maxWidth: 250 });

            layerGroup.addLayer(marker);
            count++;
        }

        aircraftCount = count;
        updateCount();
        updateRefreshTime('flights');
    } catch (err) {
        console.warn('Flight data fetch failed:', err.message);
    }
}

function updateCount() {
    const el = document.getElementById('flight-count');
    if (el) el.textContent = aircraftCount.toLocaleString();
}

function updateRefreshTime(type) {
    const el = document.getElementById(`refresh-${type}`);
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function initFlightLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup().addTo(map);

    // Fetch on init and set up refresh
    fetchFlights();
    refreshTimer = setInterval(fetchFlights, REFRESH_INTERVAL);

    // Refetch when map moves significantly
    map.on('moveend', () => {
        if (enabled) fetchFlights();
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchFlights();
        refreshTimer = setInterval(fetchFlights, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        map.removeLayer(layerGroup);
    }
}

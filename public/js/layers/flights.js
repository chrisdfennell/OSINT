// Flight tracking layer using local API proxy -> adsb.lol
// No CORS issues since requests go to our own server

const API_BASE = '/api/flights';
const REFRESH_INTERVAL = 10000;
const MOVE_DEBOUNCE = 2000;

let layerGroup;
let refreshTimer;
let moveDebounceTimer;
let map;
let enabled = true;
let aircraftCount = 0;
let fetching = false;

function createAircraftIcon(heading, onGround, emergency) {
    let color = '#00d4ff';
    if (onGround) color = '#555';
    if (emergency) color = '#ff4444';
    const rotation = heading || 0;

    return L.divIcon({
        className: 'aircraft-icon',
        html: `<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg);color:${color}" fill="currentColor">
            <path d="M12 2L8 10H3l2 4-3 6h5l5 2 5-2h5l-3-6 2-4h-5L12 2z"/>
        </svg>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
}

function formatAlt(feet) {
    if (feet == null || feet === 'ground') return 'Ground';
    return `${Math.round(feet).toLocaleString()} ft`;
}

function formatSpeed(knots) {
    if (knots == null) return 'N/A';
    return `${Math.round(knots)} kts`;
}

function buildPopup(ac) {
    const callsign = ac.flight?.trim() || ac.r || ac.hex || 'Unknown';
    const reg = ac.r || 'N/A';
    const type = ac.t || 'N/A';
    const desc = ac.desc || '';
    const operator = ac.ownOp || '';
    const alt = formatAlt(ac.alt_baro);
    const speed = formatSpeed(ac.gs);
    const heading = ac.track != null ? `${Math.round(ac.track)}°` : 'N/A';
    const vrate = ac.baro_rate != null ? `${Math.round(ac.baro_rate)} ft/min` : 'N/A';
    const squawk = ac.squawk || 'N/A';
    const emergency = ac.emergency && ac.emergency !== 'none' ? ac.emergency : null;

    let html = `<div class="popup-title">${callsign}</div>`;
    if (emergency) {
        html += `<div class="popup-row"><span class="popup-label">EMERGENCY</span><span class="popup-value" style="color:#ff4444;font-weight:700">${emergency.toUpperCase()}</span></div>`;
    }
    if (operator) {
        html += `<div class="popup-row"><span class="popup-label">Operator</span><span class="popup-value">${operator}</span></div>`;
    }
    html += `
        <div class="popup-row"><span class="popup-label">Registration</span><span class="popup-value">${reg}</span></div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">${type}${desc ? ' - ' + desc : ''}</span></div>
        <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${alt}</span></div>
        <div class="popup-row"><span class="popup-label">Speed</span><span class="popup-value">${speed}</span></div>
        <div class="popup-row"><span class="popup-label">Heading</span><span class="popup-value">${heading}</span></div>
        <div class="popup-row"><span class="popup-label">Vert Rate</span><span class="popup-value">${vrate}</span></div>
        <div class="popup-row"><span class="popup-label">Squawk</span><span class="popup-value">${squawk}</span></div>
        <div class="popup-row"><span class="popup-label">ICAO Hex</span><span class="popup-value">${ac.hex || 'N/A'}</span></div>
    `;
    return html;
}

// Strategic points covering major global air traffic corridors
const GLOBAL_HOTSPOTS = [
    { lat: 40, lon: -74, radius: 250 },   // US Northeast (NYC)
    { lat: 34, lon: -118, radius: 250 },   // US West (LA)
    { lat: 41, lon: -88, radius: 250 },    // US Central (Chicago)
    { lat: 33, lon: -84, radius: 250 },    // US Southeast (Atlanta)
    { lat: 51, lon: 0, radius: 250 },      // UK/London
    { lat: 48, lon: 2, radius: 250 },      // Europe West (Paris)
    { lat: 50, lon: 10, radius: 250 },     // Europe Central (Germany)
    { lat: 25, lon: 55, radius: 250 },     // Middle East (Dubai)
    { lat: 35, lon: 140, radius: 250 },    // East Asia (Tokyo)
    { lat: 1, lon: 104, radius: 250 },     // SE Asia (Singapore)
    { lat: -33, lon: 151, radius: 250 },   // Australia (Sydney)
    { lat: 19, lon: -99, radius: 250 },    // Mexico
    { lat: -23, lon: -46, radius: 250 },   // South America (Sao Paulo)
    { lat: 55, lon: 37, radius: 250 },     // Russia (Moscow)
    { lat: 22, lon: 114, radius: 250 },    // China South (Hong Kong)
    { lat: 49, lon: -123, radius: 250 },   // Canada West (Vancouver)
];

function getQueryPoints() {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Zoomed in close - single request centered on view
    if (zoom >= 6) {
        const center = map.getCenter();
        return [{ lat: center.lat, lon: center.lng, radius: 250 }];
    }

    // Medium zoom - grid centered on visible area
    if (zoom >= 4) {
        const center = map.getCenter();
        const points = [];
        const STEP = 7;
        const south = Math.max(bounds.getSouth(), -60);
        const north = Math.min(bounds.getNorth(), 70);
        const west = bounds.getWest();
        const east = bounds.getEast();

        for (let lat = south + STEP / 2; lat < north; lat += STEP) {
            for (let lon = west + STEP / 2; lon < east; lon += STEP) {
                points.push({ lat, lon: ((lon + 180) % 360) - 180, radius: 250 });
                if (points.length >= 12) return points;
            }
        }
        return points.length > 0 ? points : [{ lat: center.lat, lon: center.lng, radius: 250 }];
    }

    // Zoomed out wide (world view) - use strategic hotspots
    // Only include hotspots that are visible on the map
    return GLOBAL_HOTSPOTS.filter(pt => bounds.contains([pt.lat, pt.lon]));
}

async function fetchFlights() {
    if (!enabled || fetching) return;
    fetching = true;

    try {
        const points = getQueryPoints();
        const seen = new Set();

        const results = await Promise.allSettled(
            points.map(async (pt, i) => {
                if (i > 0) await new Promise(r => setTimeout(r, i * 150));
                const url = `${API_BASE}/${pt.lat.toFixed(2)}/${pt.lon.toFixed(2)}/${pt.radius}`;
                const res = await fetch(url);
                if (!res.ok) return [];
                const data = await res.json();
                return data.ac || [];
            })
        );

        layerGroup.clearLayers();
        let count = 0;

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            for (const ac of result.value) {
                if (seen.has(ac.hex)) continue;
                seen.add(ac.hex);

                const lat = ac.lat;
                const lon = ac.lon;
                if (lat == null || lon == null) continue;

                const heading = ac.track;
                const onGround = ac.alt_baro === 'ground';
                const emergency = ac.emergency && ac.emergency !== 'none';
                const icon = createAircraftIcon(heading, onGround, emergency);

                const marker = L.marker([lat, lon], { icon })
                    .bindPopup(buildPopup(ac), { maxWidth: 300 });

                layerGroup.addLayer(marker);
                count++;
            }
        }

        aircraftCount = count;
        updateUI();
    } catch (err) {
        console.warn('Flight data fetch failed:', err.message);
    } finally {
        fetching = false;
    }
}

function updateUI() {
    const el = document.getElementById('flight-count');
    if (el) el.textContent = aircraftCount.toLocaleString();
    const refreshEl = document.getElementById('refresh-flights');
    if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function initFlightLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup().addTo(map);
    fetchFlights();
    refreshTimer = setInterval(fetchFlights, REFRESH_INTERVAL);
    map.on('moveend', () => {
        if (!enabled) return;
        clearTimeout(moveDebounceTimer);
        moveDebounceTimer = setTimeout(fetchFlights, MOVE_DEBOUNCE);
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchFlights();
        if (!refreshTimer) refreshTimer = setInterval(fetchFlights, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    }
}

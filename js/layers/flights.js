// Flight tracking layer using adsb.lol API
// Free, no API key, browser CORS enabled, real-time ADS-B data
// Docs: https://api.adsb.lol
//
// Endpoints:
//   /v2/point/{lat}/{lon}/{radius_nmi} - aircraft near a point
//   Radius max: 250 nautical miles

const API_BASE = 'https://api.adsb.lol/v2';
const REFRESH_INTERVAL = 15000;  // 15 seconds (be kind to free API)
const MOVE_DEBOUNCE = 3000;      // 3s debounce on map pan

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

// Build a grid of query points to cover the visible map area.
// Each request covers a 250nmi radius (~463km). Diameter ~926km ≈ 8.3° lat.
// We use ~7° steps to overlap slightly for full coverage.
function getQueryPoints() {
    const bounds = map.getBounds();
    const south = Math.max(bounds.getSouth(), -85);
    const north = Math.min(bounds.getNorth(), 85);
    const west = bounds.getWest();
    const east = bounds.getEast();

    const STEP = 8; // degrees between grid points (~250nmi radius overlap)
    const points = [];

    // If zoomed in enough that one request covers it, just use center
    const latSpan = north - south;
    const lonSpan = east - west;
    if (latSpan <= 10 && lonSpan <= 14) {
        const center = map.getCenter();
        points.push({ lat: center.lat, lon: center.lng, radius: 250 });
        return points;
    }

    // Build grid, cap at 8 requests max to respect free API limits
    for (let lat = south + STEP / 2; lat < north; lat += STEP) {
        for (let lon = west + STEP / 2; lon < east; lon += STEP) {
            points.push({ lat, lon: ((lon + 180) % 360) - 180, radius: 250 });
            if (points.length >= 8) return points;
        }
    }

    return points.length > 0 ? points : [{ lat: map.getCenter().lat, lon: map.getCenter().lng, radius: 250 }];
}

async function fetchFlights() {
    if (!enabled || fetching) return;
    fetching = true;

    try {
        const points = getQueryPoints();
        const seen = new Set(); // dedupe by hex code

        // Fetch grid points with slight stagger to avoid rate limits
        const results = await Promise.allSettled(
            points.map(async (pt, i) => {
                // Stagger requests by 200ms each
                if (i > 0) await new Promise(r => setTimeout(r, i * 200));
                const url = `${API_BASE}/point/${pt.lat.toFixed(2)}/${pt.lon.toFixed(2)}/${pt.radius}`;
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
                // Deduplicate - same aircraft can appear in overlapping circles
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

    // Debounced refetch on map move
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

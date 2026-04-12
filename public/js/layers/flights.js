// Flight tracking layer
// Bulk positions from adsb.lol (full global grid, free).
// FR24 detail fetched on-demand when user clicks a specific aircraft.
// Renders airplane silhouettes on a single <canvas> for smooth panning.

import { showToast } from '../toast.js';

const REFRESH_INTERVAL = 15000;

let layerGroup;
let canvasRenderer;
let refreshTimer;
let map;
let enabled = true;
let aircraftCount = 0;
let fetching = false;
let lastAircraft = [];
let hasFR24 = false;

// ── Custom canvas airplane marker ──

const AircraftMarker = L.CircleMarker.extend({
    options: { heading: 0 },

    _updatePath() {
        this._renderer._drawAircraft(this);
    },

    _containsPoint(p) {
        const s = this.options.radius || 7;
        return p.distanceTo(this._point) <= s * 4;
    }
});

L.Canvas.include({
    _drawAircraft(layer) {
        if (!this._drawing || layer._empty()) return;

        const p = layer._point;
        const ctx = this._ctx;
        const heading = (layer.options.heading || 0) * Math.PI / 180;
        const s = layer.options.radius || 7;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);

        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(-s * 0.3, -s * 0.1);
        ctx.lineTo(-s * 1.1, s * 0.2);
        ctx.lineTo(-s * 0.3, s * 0.15);
        ctx.lineTo(-s * 0.3, s * 0.6);
        ctx.lineTo(-s * 0.6, s * 0.9);
        ctx.lineTo(0, s * 0.7);
        ctx.lineTo(s * 0.6, s * 0.9);
        ctx.lineTo(s * 0.3, s * 0.6);
        ctx.lineTo(s * 0.3, s * 0.15);
        ctx.lineTo(s * 1.1, s * 0.2);
        ctx.lineTo(s * 0.3, -s * 0.1);
        ctx.closePath();

        ctx.fillStyle = layer.options.fillColor || '#00d4ff';
        ctx.globalAlpha = layer.options.fillOpacity || 0.9;
        ctx.fill();

        ctx.restore();
    }
});

function getMarkerOpts(ac) {
    let color = '#00d4ff';
    const onGround = ac.alt_baro === 'ground' || ac.alt_baro === 0;
    if (onGround) color = '#555';
    if (ac.military) color = '#88aa00';
    if (ac.emergency && ac.emergency !== 'none') color = '#ff4444';
    return {
        renderer: canvasRenderer,
        radius: 7,
        heading: ac.track || 0,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 0,
        stroke: false,
        interactive: true,
        bubblingMouseEvents: false,
    };
}

function formatAlt(feet) {
    if (feet == null || feet === 'ground') return 'Ground';
    return `${Math.round(feet).toLocaleString()} ft`;
}

function formatSpeed(knots) {
    if (knots == null) return 'N/A';
    return `${Math.round(knots)} kts`;
}

// Initial popup (adsb.lol data only — fast)
function buildPopup(ac) {
    const callsign = ac.flight?.trim() || ac.r || ac.hex || 'Unknown';
    const reg = ac.r || '';
    const type = ac.t || '';
    const desc = ac.desc || '';
    const operator = ac.ownOp || '';
    const alt = formatAlt(ac.alt_baro);
    const speed = formatSpeed(ac.gs);
    const heading = ac.track != null ? `${Math.round(ac.track)}°` : 'N/A';
    const vrate = ac.baro_rate != null ? `${Math.round(ac.baro_rate)} ft/min` : 'N/A';
    const squawk = ac.squawk || 'N/A';
    const emergency = ac.emergency && ac.emergency !== 'none' ? ac.emergency : null;

    let html = '';

    // Photo placeholder (loads lazily via img src)
    if (ac.hex) {
        html += `<img src="/api/flights/photo/${ac.hex}" class="popup-aircraft-photo" loading="lazy" onerror="this.style.display='none'" alt="">`;
    }

    html += `<div class="popup-title">${callsign}</div>`;

    if (ac.military) {
        html += `<div class="popup-military-badge">MILITARY</div>`;
    }
    if (emergency) {
        html += `<div class="popup-row"><span class="popup-label">EMERGENCY</span><span class="popup-value" style="color:#ff4444;font-weight:700">${emergency.toUpperCase()}</span></div>`;
    }

    // FR24 enrichment placeholder — filled on open
    html += `<div id="fr24-detail-${ac.hex}" class="popup-fr24-detail"></div>`;

    if (operator) {
        html += `<div class="popup-row"><span class="popup-label">Operator</span><span class="popup-value">${operator}</span></div>`;
    }
    html += `
        <div class="popup-row"><span class="popup-label">Registration</span><span class="popup-value">${reg || '<span class="popup-loading-hint">click to load</span>'}</span></div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">${type ? type + (desc ? ' - ' + desc : '') : '<span class="popup-loading-hint">click to load</span>'}</span></div>
        <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${alt}</span></div>
        <div class="popup-row"><span class="popup-label">Speed</span><span class="popup-value">${speed}</span></div>
        <div class="popup-row"><span class="popup-label">Heading</span><span class="popup-value">${heading}</span></div>
        <div class="popup-row"><span class="popup-label">Vert Rate</span><span class="popup-value">${vrate}</span></div>
        <div class="popup-row"><span class="popup-label">Squawk</span><span class="popup-value">${squawk}</span></div>
        <div class="popup-row"><span class="popup-label">ICAO Hex</span><span class="popup-value">${ac.hex || 'N/A'}</span></div>
    `;
    return html;
}

// Fetch FR24 detail when popup opens
async function loadFR24Detail(hex) {
    if (!hasFR24 || !hex) return;

    const el = document.getElementById(`fr24-detail-${hex}`);
    if (!el) return;

    el.innerHTML = '<div class="popup-loading">Loading FR24 detail...</div>';

    try {
        // Get the aircraft's position to build bounds
        const ac = lastAircraft.find(a => a.hex === hex);
        if (!ac?.lat || !ac?.lon) return;

        const pad = 2; // small bounding box around this aircraft
        const bounds = `${ac.lat + pad},${ac.lat - pad},${ac.lon - pad},${ac.lon + pad}`;

        const res = await fetch(`/api/flights/enrich?bounds=${bounds}`);
        if (!res.ok) throw new Error('');

        // Now refetch the enriched flight list to get this aircraft's FR24 data
        const allRes = await fetch('/api/flights/all');
        if (!allRes.ok) throw new Error('');
        const allData = await allRes.json();
        const enriched = allData.ac?.find(a => a.hex === hex);

        if (!enriched) { el.innerHTML = ''; return; }

        let html = '';
        const route = (enriched.orig && enriched.dest) ? `${enriched.orig} → ${enriched.dest}` : '';

        if (route) {
            html += `<div class="popup-row"><span class="popup-label">Route</span><span class="popup-value popup-route">${route}</span></div>`;
        }
        if (enriched.airline && enriched.airline !== enriched.ownOp) {
            html += `<div class="popup-row"><span class="popup-label">Airline</span><span class="popup-value">${enriched.airline}</span></div>`;
        }
        if (enriched.flightNum) {
            html += `<div class="popup-row"><span class="popup-label">Flight #</span><span class="popup-value">${enriched.flightNum}</span></div>`;
        }

        el.innerHTML = html;
    } catch {
        el.innerHTML = '';
    }
}

// Stable marker registry keyed by hex — updates in place so a marker the user
// is about to click doesn't get destroyed by a refresh or pan.
const markersByHex = new Map();

function renderViewport() {
    const bounds = map.getBounds().pad(0.1);
    const seen = new Set();
    let count = 0;

    for (const ac of lastAircraft) {
        if (ac.lat == null || ac.lon == null) continue;
        if (!ac.hex) continue;
        if (!bounds.contains([ac.lat, ac.lon])) continue;

        seen.add(ac.hex);
        const opts = getMarkerOpts(ac);
        let marker = markersByHex.get(ac.hex);

        if (!marker) {
            marker = new AircraftMarker([ac.lat, ac.lon], opts)
                .bindPopup(buildPopup(ac), { maxWidth: 320 });
            marker.on('popupopen', () => loadFR24Detail(ac.hex));
            marker._acHex = ac.hex;
            markersByHex.set(ac.hex, marker);
            layerGroup.addLayer(marker);
        } else {
            marker.setLatLng([ac.lat, ac.lon]);
            marker.options.heading = opts.heading;
            marker.options.fillColor = opts.fillColor;
            if (marker.isPopupOpen?.()) {
                // Don't swap popup contents while the user has it open.
            } else {
                marker.setPopupContent(buildPopup(ac));
            }
            marker.redraw?.();
            if (!layerGroup.hasLayer(marker)) layerGroup.addLayer(marker);
        }
        count++;
    }

    // Remove markers that moved out of viewport or dropped out of the feed.
    for (const [hex, marker] of markersByHex) {
        if (!seen.has(hex)) {
            if (marker.isPopupOpen?.()) continue; // keep the marker alive while its popup is open
            layerGroup.removeLayer(marker);
            markersByHex.delete(hex);
        }
    }

    aircraftCount = count;
    const el = document.getElementById('flight-count');
    if (el) el.textContent = aircraftCount.toLocaleString();
    const refreshEl = document.getElementById('refresh-flights');
    if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

async function fetchFlights() {
    if (!enabled || fetching) return;
    fetching = true;

    try {
        const res = await fetch('/api/flights/all');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        lastAircraft = data.ac || [];
        hasFR24 = !!data.fr24;
        renderViewport();
    } catch (err) {
        console.warn('Flight data fetch failed:', err.message);
        showToast('Flight data unavailable', 'warn');
    } finally {
        fetching = false;
    }
}

export function initFlightLayer(leafletMap) {
    map = leafletMap;
    canvasRenderer = L.canvas({ padding: 0.5, tolerance: 20 });
    layerGroup = L.layerGroup().addTo(map);
    fetchFlights();
    refreshTimer = setInterval(fetchFlights, REFRESH_INTERVAL);

    map.on('moveend', () => {
        if (!enabled) return;
        renderViewport();
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
        markersByHex.clear();
        layerGroup.clearLayers();
    }
}

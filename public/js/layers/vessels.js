// Vessel / ship tracking layer
// Uses server-cached AIS data from aisstream.io WebSocket
// Renders ship silhouettes on canvas (same pattern as flights)

import { showToast } from '../toast.js';

const REFRESH_INTERVAL = 15000; // 15 seconds
const MOVE_DEBOUNCE = 2000;

let layerGroup;
let canvasRenderer;
let refreshTimer;
let moveDebounceTimer;
let map;
let enabled = false;
let vesselCount = 0;
let lastVessels = [];
let aisActive = null; // null = unknown, true/false after first check

// AIS ship type codes → categories
function shipCategory(type) {
    if (type >= 70 && type <= 79) return 'cargo';
    if (type >= 80 && type <= 89) return 'tanker';
    if (type >= 60 && type <= 69) return 'passenger';
    if (type >= 40 && type <= 49) return 'highspeed';
    if (type >= 30 && type <= 39) return 'fishing';
    if (type >= 50 && type <= 59) return 'special';
    if (type >= 20 && type <= 29) return 'wing';
    return 'other';
}

function shipColor(type) {
    const cat = shipCategory(type);
    const colors = {
        cargo: '#44cc88',
        tanker: '#cc4488',
        passenger: '#4488ff',
        highspeed: '#44ddff',
        fishing: '#ffaa44',
        special: '#aa44ff',
        wing: '#88ccaa',
        other: '#888899',
    };
    return colors[cat] || colors.other;
}

function shipLabel(type) {
    const cat = shipCategory(type);
    const labels = {
        cargo: 'Cargo',
        tanker: 'Tanker',
        passenger: 'Passenger',
        highspeed: 'High Speed',
        fishing: 'Fishing',
        special: 'Special Craft',
        wing: 'WIG',
        other: 'Vessel',
    };
    return labels[cat] || labels.other;
}

// ── Custom canvas ship marker ──
const VesselMarker = L.CircleMarker.extend({
    options: { heading: 0 },

    _updatePath() {
        this._renderer._drawVessel(this);
    },

    _containsPoint(p) {
        const s = this.options.radius || 7;
        return p.distanceTo(this._point) <= s * 3;
    }
});

L.Canvas.include({
    _drawVessel(layer) {
        if (!this._drawing || layer._empty()) return;

        const p = layer._point;
        const ctx = this._ctx;
        const heading = (layer.options.heading || 0) * Math.PI / 180;
        const s = layer.options.radius || 5;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);

        // Ship silhouette pointing up (bow = negative Y)
        ctx.beginPath();
        ctx.moveTo(0, -s);              // bow point
        ctx.lineTo(-s * 0.45, -s * 0.3); // port bow
        ctx.lineTo(-s * 0.45, s * 0.7);  // port side
        ctx.lineTo(-s * 0.35, s);        // port stern
        ctx.lineTo(s * 0.35, s);         // starboard stern
        ctx.lineTo(s * 0.45, s * 0.7);   // starboard side
        ctx.lineTo(s * 0.45, -s * 0.3);  // starboard bow
        ctx.closePath();

        ctx.fillStyle = layer.options.fillColor || '#44cc88';
        ctx.globalAlpha = layer.options.fillOpacity || 0.85;
        ctx.fill();

        ctx.restore();
    }
});

function buildPopup(v) {
    const name = v.name || 'Unknown Vessel';
    const type = shipLabel(v.type);
    const mmsi = v.mmsi || 'N/A';
    const speed = v.sog != null ? `${v.sog.toFixed(1)} kts` : 'N/A';
    const course = v.cog != null ? `${Math.round(v.cog)}°` : 'N/A';
    const heading = v.heading != null && v.heading !== 511 ? `${v.heading}°` : 'N/A';
    const callsign = v.callsign || 'N/A';
    const dest = v.dest || 'N/A';
    const imo = v.imo ? `${v.imo}` : 'N/A';

    return `
        <div class="popup-title" style="color:${shipColor(v.type)}">${name}</div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">${type}</span></div>
        <div class="popup-row"><span class="popup-label">MMSI</span><span class="popup-value">${mmsi}</span></div>
        ${imo !== 'N/A' ? `<div class="popup-row"><span class="popup-label">IMO</span><span class="popup-value">${imo}</span></div>` : ''}
        <div class="popup-row"><span class="popup-label">Callsign</span><span class="popup-value">${callsign}</span></div>
        <div class="popup-row"><span class="popup-label">Speed</span><span class="popup-value">${speed}</span></div>
        <div class="popup-row"><span class="popup-label">Course</span><span class="popup-value">${course}</span></div>
        <div class="popup-row"><span class="popup-label">Heading</span><span class="popup-value">${heading}</span></div>
        <div class="popup-row"><span class="popup-label">Destination</span><span class="popup-value">${dest}</span></div>
    `;
}

function renderViewport() {
    const bounds = map.getBounds().pad(0.1);

    layerGroup.clearLayers();
    let count = 0;

    for (const v of lastVessels) {
        if (v.lat == null || v.lon == null) continue;
        if (!bounds.contains([v.lat, v.lon])) continue;

        // Use COG for rotation if heading is unavailable (511 = not available in AIS)
        const rotation = (v.heading != null && v.heading !== 511) ? v.heading : (v.cog || 0);

        const marker = new VesselMarker([v.lat, v.lon], {
            renderer: canvasRenderer,
            radius: 7,
            heading: rotation,
            fillColor: shipColor(v.type),
            fillOpacity: 0.85,
            weight: 0,
            stroke: false,
            interactive: true,
            bubblingMouseEvents: false,
        }).bindPopup(buildPopup(v), { maxWidth: 300 });

        layerGroup.addLayer(marker);
        count++;
    }

    vesselCount = count;
    const el = document.getElementById('vessel-count');
    if (el) el.textContent = vesselCount.toLocaleString();
    const refreshEl = document.getElementById('refresh-vessels');
    if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

async function fetchVessels() {
    if (!enabled) return;

    try {
        const res = await fetch('/api/vessels/all');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.active) {
            if (aisActive === null) {
                showToast('Ship tracking requires an AISStream API key in .env', 'info');
            }
            aisActive = false;
            return;
        }

        aisActive = true;
        lastVessels = data.vessels || [];
        renderViewport();
    } catch (err) {
        console.warn('Vessel data fetch failed:', err.message);
        showToast('Vessel data unavailable', 'warn');
    }
}

export function initVesselLayer(leafletMap) {
    map = leafletMap;
    canvasRenderer = L.canvas({ padding: 0.5, tolerance: 15 });
    layerGroup = L.layerGroup();

    map.on('moveend', () => {
        if (!enabled) return;
        renderViewport();
        clearTimeout(moveDebounceTimer);
        moveDebounceTimer = setTimeout(fetchVessels, MOVE_DEBOUNCE);
    });
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchVessels();
        if (!refreshTimer) refreshTimer = setInterval(fetchVessels, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        clearTimeout(moveDebounceTimer);
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('vessel-count');
        if (el) el.textContent = '0';
    }
}

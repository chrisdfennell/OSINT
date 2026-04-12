// Live lightning strikes via Blitzortung (proxied through our server).
// Each strike renders as an SVG lightning bolt: CSS animates the element
// from a white flash down to a slow yellow fade over 60s.

import { showToast } from '../toast.js';

const SNAPSHOT_URL = '/api/lightning/recent';
const STREAM_URL = '/api/lightning/stream';
const STRIKE_LIFETIME_MS = 60 * 1000;

const BOLT_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="13 2 4 14 11 14 9 22 20 10 13 10 13 2"/></svg>';

const boltIcon = L.divIcon({
    className: 'lightning-bolt',
    html: BOLT_SVG,
    iconSize: [18, 24],
    iconAnchor: [9, 12],
});

let map;
let layerGroup;
let enabled = false;
let eventSource = null;
let strikeCount = 0;
let sweepTimer = null;

const liveStrikes = []; // { marker, expiresAt }

function addStrikeMarker(strike) {
    if (!map || !layerGroup) return;
    if (typeof strike.lat !== 'number' || typeof strike.lon !== 'number') return;

    const marker = L.marker([strike.lat, strike.lon], {
        icon: boltIcon,
        interactive: false,
        keyboard: false,
    });
    marker.addTo(layerGroup);

    liveStrikes.push({
        marker,
        expiresAt: Date.now() + STRIKE_LIFETIME_MS,
    });

    strikeCount++;
    const el = document.getElementById('lightning-count');
    if (el) el.textContent = strikeCount.toLocaleString();
}

// CSS handles color/opacity animation; this just removes expired markers.
function sweep() {
    const now = Date.now();
    for (let i = liveStrikes.length - 1; i >= 0; i--) {
        if (now >= liveStrikes[i].expiresAt) {
            layerGroup.removeLayer(liveStrikes[i].marker);
            liveStrikes.splice(i, 1);
        }
    }
}

async function loadSnapshot() {
    try {
        const res = await fetch(SNAPSHOT_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        for (const s of data.strikes || []) addStrikeMarker(s);
    } catch (err) {
        console.warn('Lightning snapshot failed:', err.message);
    }
}

function connectStream() {
    if (eventSource) return;
    eventSource = new EventSource(STREAM_URL);
    eventSource.onmessage = (ev) => {
        try {
            const strike = JSON.parse(ev.data);
            addStrikeMarker(strike);
        } catch { /* ignore */ }
    };
    eventSource.onerror = () => {
        // EventSource auto-reconnects.
    };
}

export function initLightningLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        loadSnapshot();
        connectStream();
        if (!sweepTimer) sweepTimer = setInterval(sweep, 1000);
        showToast('Lightning: live strikes via Blitzortung', 'info');
    } else {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        clearInterval(sweepTimer);
        sweepTimer = null;
        layerGroup.clearLayers();
        liveStrikes.length = 0;
        strikeCount = 0;
        const el = document.getElementById('lightning-count');
        if (el) el.textContent = '0';
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    }
}

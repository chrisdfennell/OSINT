// GDELT geolocated events layer.
// Server pulls the 15-min events export from data.gdeltproject.org and
// caches the most recent geolocated rows. We render them as tone-colored
// circles (red = negative tone, green = positive, sized by mention count).

import { showToast } from '../toast.js';

const FEED_URL = '/api/gdelt';
const REFRESH_INTERVAL = 15 * 60 * 1000;

let layerGroup;
let refreshTimer;
let map;
let enabled = false;
let eventCount = 0;

// CAMEO event-code top-level categories (first two digits of EventCode).
const CAMEO_CATEGORIES = {
    '01': 'Public statement', '02': 'Appeal', '03': 'Intent to cooperate',
    '04': 'Consult', '05': 'Diplomatic cooperation', '06': 'Material cooperation',
    '07': 'Provide aid', '08': 'Yield', '09': 'Investigate',
    '10': 'Demand', '11': 'Disapprove', '12': 'Reject',
    '13': 'Threaten', '14': 'Protest', '15': 'Force posture',
    '16': 'Reduce relations', '17': 'Coerce', '18': 'Assault',
    '19': 'Fight', '20': 'Mass violence',
};

function categoryFor(eventCode) {
    if (!eventCode) return 'Event';
    return CAMEO_CATEGORIES[eventCode.slice(0, 2)] || `Code ${eventCode}`;
}

function toneToColor(tone) {
    if (tone <= -5) return '#ff2244';
    if (tone <= -2) return '#ff8844';
    if (tone <  2)  return '#aaaacc';
    if (tone <  5)  return '#88cc66';
    return '#44cc88';
}

function mentionsToRadius(n) {
    if (n < 2) return 4;
    if (n < 5) return 5;
    if (n < 15) return 7;
    if (n < 40) return 9;
    return 12;
}

function buildPopup(e) {
    const cat = categoryFor(e.eventCode);
    const toneStr = e.tone ? e.tone.toFixed(1) : '0.0';
    const actors = [e.actor1, e.actor2].filter(Boolean).join(' → ') || '—';
    const link = e.sourceUrl
        ? `<a href="${e.sourceUrl}" target="_blank" rel="noopener" style="color:var(--accent)">Source article</a>`
        : '—';

    return `
        <div class="popup-title" style="color:${toneToColor(e.tone)}">${cat}</div>
        <div class="popup-row"><span class="popup-label">Actors</span><span class="popup-value">${actors}</span></div>
        <div class="popup-row"><span class="popup-label">Location</span><span class="popup-value">${e.place || e.countryCode || 'Unknown'}</span></div>
        <div class="popup-row"><span class="popup-label">Tone</span><span class="popup-value">${toneStr}</span></div>
        <div class="popup-row"><span class="popup-label">Goldstein</span><span class="popup-value">${e.goldstein.toFixed(1)}</span></div>
        <div class="popup-row"><span class="popup-label">Mentions</span><span class="popup-value">${e.numMentions} (${e.numSources} sources)</span></div>
        <div class="popup-row"><span class="popup-label">CAMEO</span><span class="popup-value">${e.eventCode || '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Source</span><span class="popup-value">${link}</span></div>
    `;
}

async function fetchEvents() {
    if (!enabled) return;
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const events = data.events || [];

        layerGroup.clearLayers();
        for (const e of events) {
            const circle = L.circleMarker([e.lat, e.lon], {
                radius: mentionsToRadius(e.numMentions),
                fillColor: toneToColor(e.tone),
                fillOpacity: 0.55,
                color: toneToColor(e.tone),
                weight: 1,
                opacity: 0.9,
            }).bindPopup(buildPopup(e), { maxWidth: 320 });
            layerGroup.addLayer(circle);
        }

        eventCount = events.length;
        const el = document.getElementById('gdelt-count');
        if (el) el.textContent = eventCount.toLocaleString();

        const refreshEl = document.getElementById('refresh-gdelt');
        if (refreshEl) refreshEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    } catch (err) {
        console.warn('GDELT fetch failed:', err.message);
        showToast('GDELT events unavailable', 'warn');
    }
}

export function initGdeltLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        fetchEvents();
        if (!refreshTimer) refreshTimer = setInterval(fetchEvents, REFRESH_INTERVAL);
    } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
        const el = document.getElementById('gdelt-count');
        if (el) el.textContent = '0';
    }
}

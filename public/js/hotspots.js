// Hot Spots sidebar panel — dynamic when the server has a YT_API_KEY. Sorts
// webcams by concurrent YouTube viewer count (refreshed server-side every
// 30 min) and surfaces the top entries. Falls back to the `featured` flag
// from the curated list if no YouTube key is configured.

import { webcams } from './data/webcams.js';
import { openCam } from './layers/webcams.js';

const STATS_URL = '/api/webcams/stats';
const REFRESH_INTERVAL = 30 * 60 * 1000;
const TOP_N = 5;

let listEl;
let refreshTimer = null;

function fmtViewers(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function render(items) {
    if (!items.length) {
        listEl.innerHTML = '<div class="hotspots-empty">No live streams</div>';
        return;
    }
    listEl.innerHTML = items.map(c => `
        <button type="button" class="hotspot-item" data-id="${c.id}">
            <span class="hotspot-dot${c.viewers ? ' hotspot-live' : ''}"></span>
            <span class="hotspot-name">${c.name}</span>
            ${c.viewers ? `<span class="hotspot-viewers">${fmtViewers(c.viewers)}</span>` : '<span class="hotspot-hot">HOT</span>'}
        </button>
    `).join('');
    listEl.querySelectorAll('.hotspot-item').forEach(btn => {
        btn.addEventListener('click', () => openCam(btn.dataset.id));
    });
}

async function refresh() {
    if (!listEl) return;

    let stats = { enabled: false, entries: [] };
    try {
        const res = await fetch(STATS_URL);
        if (res.ok) stats = await res.json();
    } catch { /* ignore, fallback below */ }

    let items;
    if (stats.enabled && stats.entries.length) {
        // Sort live cams by viewer count, then fall back to featured order
        // for anything without live viewers.
        const byId = Object.fromEntries(stats.entries.map(e => [e.id, e]));
        items = webcams
            .map(c => ({ ...c, viewers: byId[c.id]?.viewers || 0 }))
            .sort((a, b) => (b.viewers - a.viewers) || (b.featured - a.featured))
            .slice(0, TOP_N);
    } else {
        items = webcams
            .filter(c => c.featured)
            .map(c => ({ ...c, viewers: 0 }))
            .slice(0, TOP_N);
    }

    render(items);
}

export function initHotSpots() {
    listEl = document.getElementById('hotspots-list');
    if (!listEl) return;
    refresh();
    if (!refreshTimer) refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
}

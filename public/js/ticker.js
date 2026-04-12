// News ticker: scrolls aggregated RSS headlines across the bottom of the
// viewport just above the status bar. Refreshes every 5 min; items loop
// seamlessly via a duplicated track.

const FEED_URL = '/api/news';
const REFRESH_INTERVAL = 5 * 60 * 1000;
const SECONDS_PER_ITEM = 8;

let trackEl;
let lastItemKeys = '';

function buildItem(item) {
    const href = item.url || '#';
    return `<a class="ticker-item" href="${href}" target="_blank" rel="noopener">
        <span class="ticker-source">${item.source}</span>
        <span class="ticker-title">${item.title}</span>
    </a>`;
}

async function refresh() {
    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) return;

        const key = items.map(i => i.url || i.title).join('|');
        if (key === lastItemKeys) return;
        lastItemKeys = key;

        const html = items.map(buildItem).join('');
        // Duplicate the track so the keyframe's -50% translate loops seamlessly.
        trackEl.innerHTML = html + html;

        const duration = Math.max(60, items.length * SECONDS_PER_ITEM);
        trackEl.style.animationDuration = `${duration}s`;
    } catch (err) {
        console.warn('News ticker fetch failed:', err.message);
    }
}

export function initTicker() {
    trackEl = document.getElementById('ticker-track');
    if (!trackEl) return;
    refresh();
    setInterval(refresh, REFRESH_INTERVAL);
}

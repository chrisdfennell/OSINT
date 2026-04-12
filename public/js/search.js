// Place search: Nominatim geocoding proxied via /api/geocode. Debounced input,
// dropdown of matches, click to fly the map to the selected result.

const GEOCODE_URL = '/api/geocode';
const DEBOUNCE_MS = 350;

let map;
let inputEl, resultsEl;
let debounceTimer = null;
let lastQuery = '';
let searchMarker = null;

function clearResults() {
    resultsEl.innerHTML = '';
    resultsEl.classList.remove('visible');
}

function renderResults(items) {
    if (!items.length) {
        resultsEl.innerHTML = '<div class="search-empty">No results</div>';
        resultsEl.classList.add('visible');
        return;
    }
    resultsEl.innerHTML = items.map((r, i) => `
        <button class="search-result" data-idx="${i}">
            <div class="search-result-name">${r.name || r.display_name.split(',')[0]}</div>
            <div class="search-result-detail">${r.display_name}</div>
        </button>
    `).join('');
    resultsEl.classList.add('visible');

    resultsEl.querySelectorAll('.search-result').forEach((btn, idx) => {
        btn.addEventListener('click', () => pickResult(items[idx]));
    });
}

function pickResult(r) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (!isFinite(lat) || !isFinite(lon)) return;

    // Use the bounding box for a snug framing when available.
    const bb = r.boundingbox;
    if (Array.isArray(bb) && bb.length === 4) {
        const [s, n, w, e] = bb.map(parseFloat);
        if ([s, n, w, e].every(isFinite)) {
            map.flyToBounds([[s, w], [n, e]], { maxZoom: 13, duration: 0.8 });
        } else {
            map.flyTo([lat, lon], 11, { duration: 0.8 });
        }
    } else {
        map.flyTo([lat, lon], 11, { duration: 0.8 });
    }

    if (searchMarker) searchMarker.remove();
    searchMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(r.display_name).openPopup();

    clearResults();
    inputEl.value = r.name || r.display_name.split(',')[0];
    inputEl.blur();
}

async function runSearch(q) {
    if (!q || q.length < 2) { clearResults(); return; }
    if (q === lastQuery) return;
    lastQuery = q;
    try {
        const res = await fetch(`${GEOCODE_URL}?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = await res.json();
        if (q !== lastQuery) return; // a newer query started while this was pending
        renderResults(Array.isArray(items) ? items : []);
    } catch (err) {
        console.warn('Search failed:', err.message);
        resultsEl.innerHTML = '<div class="search-empty">Search failed</div>';
        resultsEl.classList.add('visible');
    }
}

export function initSearch(leafletMap) {
    map = leafletMap;
    inputEl = document.getElementById('search-input');
    resultsEl = document.getElementById('search-results');
    if (!inputEl || !resultsEl) return;

    inputEl.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { inputEl.value = ''; clearResults(); inputEl.blur(); }
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            runSearch(inputEl.value.trim());
        }
    });

    document.addEventListener('click', (e) => {
        if (!resultsEl.contains(e.target) && e.target !== inputEl) clearResults();
    });
}

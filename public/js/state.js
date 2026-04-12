// URL hash state sync: share a view by copying the URL. Encodes map
// center/zoom, which layer toggles are on, and the selected base map.
//
// Format: #m=lat,lon,zoom&l=ids,separated,by,comma&b=dark|satellite|streets

const LAYER_IDS = [
    'flights', 'earthquakes', 'fires', 'volcanoes', 'cyclones', 'vessels',
    'weather', 'nexrad', 'rainviewer', 'clouds', 'wind', 'temp',
    'gdelt', 'lightning', 'iss', 'satellites', 'aurora', 'airquality', 'cables', 'powerplants', 'webcams',
];

const HASH_DEBOUNCE_MS = 250;
let writeTimer = null;
let map;

function parseHash() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const m = params.get('m');
    const l = params.get('l');
    const b = params.get('b');

    const state = {};
    if (m) {
        const [lat, lon, z] = m.split(',').map(parseFloat);
        if ([lat, lon, z].every(isFinite)) state.view = { lat, lon, zoom: z };
    }
    if (l != null) state.layers = l ? l.split(',').filter(Boolean) : [];
    if (b) state.basemap = b;
    return state;
}

function writeHash() {
    if (!map) return;
    const c = map.getCenter();
    const parts = [];
    parts.push(`m=${c.lat.toFixed(4)},${c.lng.toFixed(4)},${map.getZoom()}`);

    const on = LAYER_IDS.filter(id => {
        const el = document.getElementById(`layer-${id}`);
        return el && el.checked;
    });
    parts.push(`l=${on.join(',')}`);

    const basemap = document.querySelector('input[name="basemap"]:checked');
    if (basemap) parts.push(`b=${basemap.value}`);

    const newHash = '#' + parts.join('&');
    if (location.hash !== newHash) {
        history.replaceState(null, '', newHash);
    }
}

function scheduleWrite() {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(writeHash, HASH_DEBOUNCE_MS);
}

// Apply parsed state to the UI. Layer checkboxes dispatch 'change' so the
// existing handlers in app.js wire up their setEnabled calls.
function applyState(state) {
    if (!state) return;

    if (state.view) {
        map.setView([state.view.lat, state.view.lon], state.view.zoom, { animate: false });
    }

    if (state.basemap) {
        const radio = document.querySelector(`input[name="basemap"][value="${state.basemap}"]`);
        if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    if (state.layers) {
        const wanted = new Set(state.layers);
        for (const id of LAYER_IDS) {
            const el = document.getElementById(`layer-${id}`);
            if (!el) continue;
            const shouldBeOn = wanted.has(id);
            if (el.checked !== shouldBeOn) {
                el.checked = shouldBeOn;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
}

export function initStateSync(leafletMap) {
    map = leafletMap;

    const initial = parseHash();
    if (initial) applyState(initial);

    map.on('moveend zoomend', scheduleWrite);

    for (const id of LAYER_IDS) {
        const el = document.getElementById(`layer-${id}`);
        if (el) el.addEventListener('change', scheduleWrite);
    }
    document.querySelectorAll('input[name="basemap"]').forEach(r =>
        r.addEventListener('change', scheduleWrite));

    // Write once after initial apply so the URL reflects current state.
    scheduleWrite();
}

// Power plants from WRI's Global Power Plant Database (≥100 MW). Rendered
// on a shared canvas renderer for performance — ~10k markers. Colored by
// fuel type, sized by capacity. Nuclear gets a distinct highlight.

import { showToast } from '../toast.js';

const FEED_URL = '/api/powerplants';

let map;
let layerGroup;
let canvasRenderer;
let enabled = false;
let loaded = false;
let loading = null;

const FUEL_COLORS = {
    Coal:        '#555555',
    Gas:         '#ff9900',
    Oil:         '#7a3f1a',
    Nuclear:     '#ff3344',
    Hydro:       '#3388ff',
    Solar:       '#ffcc00',
    Wind:        '#66ddcc',
    Biomass:     '#66aa33',
    Geothermal:  '#aa44ff',
    Waste:       '#889988',
    Wave_and_Tidal: '#44bbff',
    Storage:     '#cccccc',
    Cogeneration: '#ddaa44',
    Petcoke:     '#3a2a1a',
    Other:       '#999999',
};

function colorFor(fuel) {
    return FUEL_COLORS[fuel] || FUEL_COLORS.Other;
}

function radiusFor(mw) {
    if (mw >= 3000) return 9;
    if (mw >= 1500) return 7;
    if (mw >= 500)  return 5;
    if (mw >= 200)  return 4;
    return 3;
}

function popupFor(p) {
    return `
        <div class="popup-title" style="color:${colorFor(p.f)}">${p.n}</div>
        <div class="popup-row"><span class="popup-label">Fuel</span><span class="popup-value">${p.f || '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Capacity</span><span class="popup-value">${p.mw.toLocaleString()} MW</span></div>
        <div class="popup-row"><span class="popup-label">Country</span><span class="popup-value">${p.co || '—'}</span></div>
        ${p.o ? `<div class="popup-row"><span class="popup-label">Owner</span><span class="popup-value">${p.o}</span></div>` : ''}
        ${p.y ? `<div class="popup-row"><span class="popup-label">Commissioned</span><span class="popup-value">${p.y}</span></div>` : ''}
    `;
}

async function load() {
    if (loaded) return;
    if (loading) return loading;

    loading = (async () => {
        try {
            const res = await fetch(FEED_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const plants = data.plants || [];
            if (!plants.length) {
                showToast('Power plant data not yet loaded — try again in ~30s', 'info');
                return;
            }

            for (const p of plants) {
                const isNuclear = p.f === 'Nuclear';
                const color = colorFor(p.f);
                const marker = L.circleMarker([p.lat, p.lon], {
                    renderer: canvasRenderer,
                    radius: radiusFor(p.mw),
                    color: isNuclear ? '#ffdd44' : color,
                    weight: isNuclear ? 1.5 : 1,
                    fillColor: color,
                    fillOpacity: 0.7,
                    opacity: 0.9,
                }).bindPopup(popupFor(p), { maxWidth: 280 });
                layerGroup.addLayer(marker);
            }
            loaded = true;

            const el = document.getElementById('powerplant-count');
            if (el) el.textContent = plants.length.toLocaleString();
        } catch (err) {
            console.warn('Power plant load failed:', err.message);
            showToast('Power plants unavailable', 'warn');
        } finally {
            loading = null;
        }
    })();
    return loading;
}

export function initPowerPlantsLayer(leafletMap) {
    map = leafletMap;
    canvasRenderer = L.canvas({ padding: 0.5 });
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        load();
    } else if (map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
    }
}

// Submarine cable layer: TeleGeography's public cable-geo.json (LineStrings
// with a per-cable color in properties). Rendered as a GeoJSON layer, styled
// thin so it doesn't dominate other overlays.

import { showToast } from '../toast.js';

const FEED_URL = '/api/cables';

let map;
let layerGroup;
let loaded = false;
let loading = null;
let enabled = false;

function featurePopup(feature) {
    const p = feature.properties || {};
    return `
        <div class="popup-title" style="color:${p.color || '#88ccff'}">${p.name || 'Submarine Cable'}</div>
        ${p.slug ? `<div class="popup-row"><span class="popup-label">ID</span><span class="popup-value">${p.slug}</span></div>` : ''}
        <div class="popup-row"><span class="popup-label">Source</span><span class="popup-value"><a href="https://www.submarinecablemap.com/" target="_blank" rel="noopener" style="color:var(--accent)">TeleGeography</a></span></div>
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

            const geoLayer = L.geoJSON(data, {
                style: (feature) => ({
                    color: feature.properties?.color || '#88ccff',
                    weight: 1.2,
                    opacity: 0.7,
                }),
                onEachFeature: (feature, layer) => {
                    layer.bindPopup(featurePopup(feature), { maxWidth: 280 });
                    layer.on('mouseover', () => layer.setStyle({ weight: 3, opacity: 1 }));
                    layer.on('mouseout',  () => layer.setStyle({ weight: 1.2, opacity: 0.7 }));
                },
            });
            geoLayer.addTo(layerGroup);
            loaded = true;
        } catch (err) {
            console.warn('Submarine cables load failed:', err.message);
            showToast('Submarine cables unavailable', 'warn');
        } finally {
            loading = null;
        }
    })();
    return loading;
}

export function initCablesLayer(leafletMap) {
    map = leafletMap;
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

// Mapillary ground-view pick tool. Click anywhere on the map and the server
// queries Mapillary's Graph API for the closest street-level photo. Popup
// shows the thumbnail with capture date and a link to the full viewer.

import { showToast } from './toast.js';

let map;
let enabled = false;
let pickLayer;
let activeMarker = null;
let active = null; // server enablement result, cached

const PIN_ICON = L.divIcon({
    className: 'mapillary-pin',
    html: '<svg viewBox="0 0 24 24" width="26" height="26" fill="#00d4ff" stroke="#003355" stroke-width="1.5"><path d="M12 2l8 5v10l-8 5-8-5V7z"/><circle cx="12" cy="12" r="3" fill="#003355"/></svg>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});

function buildLoading(lat, lon) {
    return `
        <div class="popup-title" style="color:#00d4ff">Ground view</div>
        <div class="popup-row"><span class="popup-label">Query</span><span class="popup-value">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></div>
        <div class="popup-row"><span class="popup-label">Status</span><span class="popup-value">Searching Mapillary…</span></div>
    `;
}

function buildNoResults(lat, lon) {
    return `
        <div class="popup-title" style="color:#00d4ff">Ground view</div>
        <div class="popup-row"><span class="popup-label">Query</span><span class="popup-value">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></div>
        <div class="popup-row"><span class="popup-label">Status</span><span class="popup-value">No Mapillary imagery within ~200 m.</span></div>
        <div class="popup-row"><a href="https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17" target="_blank" rel="noopener" style="color:var(--accent)">Browse this area on Mapillary ↗</a></div>
    `;
}

function buildResultHtml(lat, lon, images) {
    const primary = images[0];
    const dateStr = primary.capturedAt ? new Date(primary.capturedAt).toISOString().slice(0, 10) : '—';
    const distStr = primary.distM != null ? `${Math.round(primary.distM)} m away` : '';

    const thumbs = images.slice(0, 4).map(img => {
        const d = img.capturedAt ? new Date(img.capturedAt).toISOString().slice(0, 10) : '';
        return `
            <a class="mly-thumb" href="https://www.mapillary.com/app/?pKey=${img.id}&focus=photo" target="_blank" rel="noopener" title="${d}${img.pano ? ' (360°)' : ''}">
                <img src="${img.thumb}" alt="Mapillary ${d}">
                ${img.pano ? '<span class="mly-pano">360°</span>' : ''}
            </a>
        `;
    }).join('');

    return `
        <div class="popup-title" style="color:#00d4ff">Ground view${primary.pano ? ' · 360°' : ''}</div>
        <div class="popup-row"><span class="popup-label">Closest</span><span class="popup-value">${distStr}</span></div>
        <div class="popup-row"><span class="popup-label">Captured</span><span class="popup-value">${dateStr}</span></div>
        <div class="popup-row"><span class="popup-label">Heading</span><span class="popup-value">${primary.heading != null ? Math.round(primary.heading) + '°' : '—'}</span></div>
        <div class="mly-thumbs">${thumbs}</div>
        <div class="popup-row"><a href="https://www.mapillary.com/app/?pKey=${primary.id}&focus=photo" target="_blank" rel="noopener" style="color:var(--accent)">Open in Mapillary viewer ↗</a></div>
    `;
}

async function query(lat, lon, marker) {
    try {
        const r = await fetch(`/api/mapillary/nearest?lat=${lat}&lon=${lon}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        if (!data.active) {
            active = false;
            marker.setPopupContent(`
                <div class="popup-title" style="color:#00d4ff">Ground view</div>
                <div class="popup-row"><span class="popup-value">Set <code>MAPILLARY_TOKEN</code> in .env to enable.</span></div>
            `);
            return;
        }

        active = true;
        if (!data.images.length) {
            marker.setPopupContent(buildNoResults(lat, lon));
        } else {
            marker.setPopupContent(buildResultHtml(lat, lon, data.images));
        }
    } catch (err) {
        marker.setPopupContent(`
            <div class="popup-title" style="color:#00d4ff">Ground view</div>
            <div class="popup-row"><span class="popup-value">Query failed: ${err.message}</span></div>
        `);
    }
}

function dropPin(latlng) {
    if (activeMarker) pickLayer.removeLayer(activeMarker);
    const { lat, lng } = latlng;

    activeMarker = L.marker([lat, lng], { icon: PIN_ICON })
        .bindPopup(buildLoading(lat, lng), { maxWidth: 320, autoClose: false })
        .addTo(pickLayer)
        .openPopup();

    query(lat, lng, activeMarker);
}

function onMapClick(e) {
    if (!enabled) return;
    if (e.originalEvent?.target?.closest?.('.leaflet-popup')) return;
    dropPin(e.latlng);
}

export function initMapillaryTool(leafletMap) {
    map = leafletMap;
    pickLayer = L.layerGroup();
    map.on('click', onMapClick);
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        pickLayer.addTo(map);
        map.getContainer().classList.add('mapillary-tool-active');
        showToast('Ground view: click the map to pull nearest Mapillary photo', 'info');
    } else {
        if (map.hasLayer(pickLayer)) map.removeLayer(pickLayer);
        map.getContainer().classList.remove('mapillary-tool-active');
        if (activeMarker) { pickLayer.removeLayer(activeMarker); activeMarker = null; }
    }
}

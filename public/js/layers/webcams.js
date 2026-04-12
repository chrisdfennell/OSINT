// Live webcam markers. Each curated entry gets a marker; the popup embeds
// the YouTube live stream. Hot Spots panel exposes `openCam(id)` for
// quick-fly behavior from outside the map.

import { webcams } from '../data/webcams.js';

let map;
let layerGroup;
let enabled = false;
const markersById = new Map();

function buildPopup(cam) {
    return `
        <div class="popup-title" style="color:#ff99dd">${cam.name}${cam.featured ? ' <span class="webcam-hot">HOT</span>' : ''}</div>
        <div class="webcam-embed">
            <iframe
                src="https://www.youtube.com/embed/live_stream?channel=${cam.channel}&autoplay=1&mute=1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy"></iframe>
        </div>
        <div class="popup-row"><span class="popup-label">Channel</span><span class="popup-value"><a href="${cam.url}" target="_blank" rel="noopener" style="color:var(--accent)">Open on YouTube</a></span></div>
    `;
}

export function initWebcamsLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();

    for (const cam of webcams) {
        const marker = L.marker([cam.lat, cam.lon], {
            icon: L.divIcon({
                className: `webcam-icon${cam.featured ? ' webcam-icon-hot' : ''}`,
                html: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
                iconSize: [26, 26],
                iconAnchor: [13, 13],
            }),
        }).bindPopup(buildPopup(cam), { maxWidth: 420 });
        layerGroup.addLayer(marker);
        markersById.set(cam.id, marker);
    }
}

// Called by the Hot Spots panel when the user clicks a featured webcam.
export function openCam(id) {
    const cam = webcams.find(c => c.id === id);
    const marker = markersById.get(id);
    if (!cam || !marker) return;

    // Ensure the layer is visible.
    const toggle = document.getElementById('layer-webcams');
    if (toggle && !toggle.checked) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }

    map.flyTo([cam.lat, cam.lon], 10, { duration: 0.8 });
    setTimeout(() => marker.openPopup(), 850);
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
    } else if (map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
    }
}

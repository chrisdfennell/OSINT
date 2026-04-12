// ISS live tracker + projected ground track for the next ~3 orbits.
// Live position: poll /api/iss every 5s.
// Projected track: /api/iss/track (server-propagated via wheretheiss.at,
// cached 10 min). Split at the antimeridian so polylines don't draw across
// the whole world. Rolling tail of past polled positions drawn as solid line.

const LIVE_URL = '/api/iss';
const TRACK_URL = '/api/iss/track';
const POLL_INTERVAL = 5000;
const TRACK_REFRESH = 10 * 60 * 1000;
const TRAIL_MAX_POINTS = 90;
const ISS_COLOR = '#ff44cc';

let map;
let layerGroup;
let marker = null;
let pastTrail = null;
let futureTracks = [];
let pollTimer = null;
let trackTimer = null;
let enabled = false;
const trailPoints = [];

// Leaflet polylines draw straight across if longitudes jump from +180 → -180.
// Split the input track into segments wherever that jump occurs.
function splitAtAntimeridian(points) {
    const segments = [];
    let current = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (current.length) {
            const prev = current[current.length - 1];
            if (Math.abs(p[1] - prev[1]) > 180) {
                segments.push(current);
                current = [];
            }
        }
        current.push(p);
    }
    if (current.length > 1) segments.push(current);
    return segments;
}

function buildPopup(d) {
    const alt = d.altitude ? `${d.altitude.toFixed(0)} km` : '—';
    const vel = d.velocity ? `${d.velocity.toFixed(0)} km/h` : '—';
    const vis = d.visibility || '—';
    return `
        <div class="popup-title" style="color:${ISS_COLOR}">International Space Station</div>
        <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${alt}</span></div>
        <div class="popup-row"><span class="popup-label">Velocity</span><span class="popup-value">${vel}</span></div>
        <div class="popup-row"><span class="popup-label">Visibility</span><span class="popup-value">${vis}</span></div>
        <div class="popup-row"><span class="popup-label">Lat/Lon</span><span class="popup-value">${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}</span></div>
    `;
}

async function pollLive() {
    if (!enabled) return;
    try {
        const res = await fetch(LIVE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return;

        trailPoints.push([d.latitude, d.longitude]);
        if (trailPoints.length > TRAIL_MAX_POINTS) trailPoints.shift();

        if (!marker) {
            marker = L.marker([d.latitude, d.longitude], {
                icon: L.divIcon({
                    className: 'iss-icon',
                    html: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="13" width="6" height="6"/><rect x="2" y="14" width="8" height="4"/><rect x="22" y="14" width="8" height="4"/><line x1="14" y1="2" x2="14" y2="13" stroke-width="1"/><line x1="18" y1="19" x2="18" y2="30" stroke-width="1"/></svg>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                }),
            }).bindPopup(buildPopup(d), { maxWidth: 280 });
            marker.addTo(layerGroup);
        } else {
            marker.setLatLng([d.latitude, d.longitude]);
            marker.setPopupContent(buildPopup(d));
        }

        // Past trail: solid, slightly thicker so it reads as "already flown".
        const segs = splitAtAntimeridian(trailPoints);
        if (pastTrail) {
            layerGroup.removeLayer(pastTrail);
            pastTrail = null;
        }
        if (segs.length) {
            pastTrail = L.layerGroup();
            for (const seg of segs) {
                L.polyline(seg, { color: ISS_COLOR, weight: 2.5, opacity: 0.7 }).addTo(pastTrail);
            }
            pastTrail.addTo(layerGroup);
        }
    } catch (err) {
        console.warn('ISS poll failed:', err.message);
    }
}

async function loadTrack() {
    if (!enabled) return;
    try {
        const res = await fetch(TRACK_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const pts = (data.points || []).map(p => [p.lat, p.lon]);

        for (const layer of futureTracks) layerGroup.removeLayer(layer);
        futureTracks = [];

        const segs = splitAtAntimeridian(pts);
        for (const seg of segs) {
            const line = L.polyline(seg, {
                color: ISS_COLOR, weight: 1.5, opacity: 0.45, dashArray: '4,6',
            });
            line.addTo(layerGroup);
            futureTracks.push(line);
        }
    } catch (err) {
        console.warn('ISS track load failed:', err.message);
    }
}

export function initISSLayer(leafletMap) {
    map = leafletMap;
    layerGroup = L.layerGroup();
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        layerGroup.addTo(map);
        pollLive();
        loadTrack();
        if (!pollTimer) pollTimer = setInterval(pollLive, POLL_INTERVAL);
        if (!trackTimer) trackTimer = setInterval(loadTrack, TRACK_REFRESH);
    } else {
        clearInterval(pollTimer);
        clearInterval(trackTimer);
        pollTimer = null;
        trackTimer = null;
        layerGroup.clearLayers();
        marker = null;
        pastTrail = null;
        futureTracks = [];
        trailPoints.length = 0;
        if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    }
}

// Sun / shadow calculator. Click anywhere on the map to drop a pin; the popup
// shows sun azimuth/altitude, sunrise/sunset, and a dashed line pointing in
// the direction shadows fall at the chosen time. The time/date inputs in the
// popup let you rewind or fast-forward to re-check against a reference photo —
// classic chronolocation / shadow-angle geolocation workflow.

import { showToast } from './toast.js';

let map;
let enabled = false;
let pickLayer;
let activePin = null;
let activeShadow = null;

const PIN_ICON = L.divIcon({
    className: 'sun-pin',
    html: '<svg viewBox="0 0 24 24" width="28" height="28" fill="#ffcc33" stroke="#ff8800" stroke-width="1.2"><circle cx="12" cy="12" r="5"/><g stroke="#ffcc33" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><line x1="4" y1="4" x2="6" y2="6"/><line x1="18" y1="18" x2="20" y2="20"/><line x1="4" y1="20" x2="6" y2="18"/><line x1="18" y1="6" x2="20" y2="4"/></g></svg>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});

// SunCalc returns azimuth measured from south, increasing clockwise (radians).
// Convert to a compass bearing from north (0°=N, 90°=E).
function azimuthToBearing(azRad) {
    return (azRad * 180 / Math.PI + 180 + 360) % 360;
}

// Project a point `metres` in the direction `bearingDeg` from (lat,lon) and
// return the resulting [lat, lon]. Uses the standard great-circle formula.
function projectPoint(lat, lon, bearingDeg, metres) {
    const R = 6378137;
    const d = metres / R;
    const br = bearingDeg * Math.PI / 180;
    const la1 = lat * Math.PI / 180;
    const lo1 = lon * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
    const lo2 = lo1 + Math.atan2(
        Math.sin(br) * Math.sin(d) * Math.cos(la1),
        Math.cos(d) - Math.sin(la1) * Math.sin(la2),
    );
    return [la2 * 180 / Math.PI, ((lo2 * 180 / Math.PI) + 540) % 360 - 180];
}

function fmtTime(d) {
    if (!d || isNaN(d)) return '—';
    return d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildPopupHtml(lat, lon, date) {
    if (typeof SunCalc === 'undefined') {
        return '<div class="popup-title">SunCalc library not loaded.</div>';
    }
    const pos = SunCalc.getPosition(date, lat, lon);
    const altDeg = pos.altitude * 180 / Math.PI;
    const sunBearing = azimuthToBearing(pos.azimuth);
    const shadowBearing = (sunBearing + 180) % 360;
    const times = SunCalc.getTimes(date, lat, lon);

    const dateStr = date.toISOString().slice(0, 10);
    const timeStr = date.toISOString().slice(11, 16);

    // Shadow length multiplier for an object of unit height. Clamp at 200×.
    const shadowMul = altDeg > 0
        ? Math.min(200, 1 / Math.tan(pos.altitude))
        : null;

    return `
        <div class="popup-title" style="color:#ffcc33">Sun / Shadow</div>
        <div class="popup-row"><span class="popup-label">Lat/Lon</span><span class="popup-value">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></div>
        <div class="popup-row"><span class="popup-label">Altitude</span><span class="popup-value">${altDeg.toFixed(1)}°${altDeg <= 0 ? ' <em>(below horizon)</em>' : ''}</span></div>
        <div class="popup-row"><span class="popup-label">Sun azimuth</span><span class="popup-value">${sunBearing.toFixed(1)}° (from N)</span></div>
        <div class="popup-row"><span class="popup-label">Shadow dir</span><span class="popup-value">${shadowBearing.toFixed(1)}°</span></div>
        ${shadowMul ? `<div class="popup-row"><span class="popup-label">Shadow length</span><span class="popup-value">${shadowMul.toFixed(2)} × height</span></div>` : ''}
        <div class="popup-row"><span class="popup-label">Sunrise</span><span class="popup-value">${fmtTime(times.sunrise)}</span></div>
        <div class="popup-row"><span class="popup-label">Sunset</span><span class="popup-value">${fmtTime(times.sunset)}</span></div>
        <div class="sun-controls">
            <label>Date <input type="date" class="sun-date" value="${dateStr}"></label>
            <label>UTC <input type="time" class="sun-time" value="${timeStr}"></label>
            <button class="sun-now" type="button">Now</button>
        </div>
    `;
}

function redrawShadow(lat, lon, date) {
    if (!activeShadow) return;
    const pos = SunCalc.getPosition(date, lat, lon);
    const altDeg = pos.altitude * 180 / Math.PI;
    activeShadow.setStyle({ opacity: altDeg > 0 ? 0.95 : 0.25 });
    const bearing = (azimuthToBearing(pos.azimuth) + 180) % 360;
    const far = projectPoint(lat, lon, bearing, 2000);
    activeShadow.setLatLngs([[lat, lon], far]);
}

function wirePopupControls(marker, lat, lon) {
    const popupEl = marker.getPopup().getElement();
    if (!popupEl) return;

    const dateEl = popupEl.querySelector('.sun-date');
    const timeEl = popupEl.querySelector('.sun-time');
    const nowBtn = popupEl.querySelector('.sun-now');

    const apply = () => {
        const d = dateEl.value, t = timeEl.value;
        if (!d || !t) return;
        const iso = `${d}T${t}:00Z`;
        const parsed = new Date(iso);
        if (isNaN(parsed)) return;
        marker._sunDate = parsed;
        redrawShadow(lat, lon, parsed);
        // Rebuild the popup HTML body to refresh displayed numbers.
        marker.getPopup().setContent(buildPopupHtml(lat, lon, parsed));
        marker.openPopup();
    };

    dateEl?.addEventListener('change', apply);
    timeEl?.addEventListener('change', apply);
    nowBtn?.addEventListener('click', () => {
        const d = new Date();
        dateEl.value = d.toISOString().slice(0, 10);
        timeEl.value = d.toISOString().slice(11, 16);
        apply();
    });
}

function dropPin(latlng) {
    if (typeof SunCalc === 'undefined') {
        showToast('SunCalc library failed to load (CDN blocked?)', 'warn');
        return;
    }
    if (activePin) pickLayer.removeLayer(activePin);
    if (activeShadow) pickLayer.removeLayer(activeShadow);

    const now = new Date();
    const { lat, lng } = latlng;

    activePin = L.marker([lat, lng], { icon: PIN_ICON })
        .bindPopup(buildPopupHtml(lat, lng, now), { maxWidth: 320, autoClose: false });
    activePin._sunDate = now;

    activeShadow = L.polyline([[lat, lng], [lat, lng]], {
        color: '#ffaa33', weight: 3, opacity: 0.9,
        dashArray: '6,6', interactive: false,
    });

    activeShadow.addTo(pickLayer);
    activePin.addTo(pickLayer).openPopup();

    redrawShadow(lat, lng, now);

    activePin.on('popupopen', () => wirePopupControls(activePin, lat, lng));
    // First time the popup opens the DOM is ready; wire once now.
    setTimeout(() => wirePopupControls(activePin, lat, lng), 0);
}

function onMapClick(e) {
    if (!enabled) return;
    // Ignore clicks on existing layers (popups, markers) — let them behave
    // normally. Leaflet fires map click even then, so guard on originalEvent.
    if (e.originalEvent?.target?.closest?.('.leaflet-popup')) return;
    dropPin(e.latlng);
}

export function initSunTool(leafletMap) {
    map = leafletMap;
    pickLayer = L.layerGroup();
    map.on('click', onMapClick);
}

export function setEnabled(on) {
    enabled = on;
    if (on) {
        pickLayer.addTo(map);
        map.getContainer().classList.add('sun-tool-active');
        showToast('Sun tool: click the map to check sun/shadow angle', 'info');
    } else {
        if (map.hasLayer(pickLayer)) map.removeLayer(pickLayer);
        map.getContainer().classList.remove('sun-tool-active');
        if (activePin) { pickLayer.removeLayer(activePin); activePin = null; }
        if (activeShadow) { pickLayer.removeLayer(activeShadow); activeShadow = null; }
    }
}

// Measure + draw tool. Uses Leaflet-Geoman's toolbar for ruler (polyline),
// polygon area, and markers. Adds live distance/area labels to finished
// shapes so you can read measurements without opening a popup.

const KM_TO_MI = 0.621371;
const SQKM_TO_SQMI = 0.386102;

function fmtDistance(m) {
    const km = m / 1000;
    const mi = km * KM_TO_MI;
    if (km < 1) return `${m.toFixed(0)} m (${(m * 3.28084).toFixed(0)} ft)`;
    return `${km.toFixed(2)} km (${mi.toFixed(2)} mi)`;
}

function fmtArea(m2) {
    const km2 = m2 / 1_000_000;
    const mi2 = km2 * SQKM_TO_SQMI;
    if (km2 < 0.01) return `${m2.toFixed(0)} m²`;
    return `${km2.toFixed(2)} km² (${mi2.toFixed(2)} mi²)`;
}

// Great-circle distance along a polyline (sum of segment distances).
function polylineDistance(latlngs, map) {
    let total = 0;
    for (let i = 1; i < latlngs.length; i++) {
        total += map.distance(latlngs[i - 1], latlngs[i]);
    }
    return total;
}

// Shoelace area in degrees, roughly scaled to square meters — good enough
// for typical OSINT measurements, not for sub-meter work.
function polygonAreaSqMeters(latlngs) {
    if (latlngs.length < 3) return 0;
    const R = 6378137;
    let total = 0;
    for (let i = 0; i < latlngs.length; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % latlngs.length];
        total += (p2.lng - p1.lng) * Math.PI / 180 *
            (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    return Math.abs(total * R * R / 2);
}

function attachLabel(layer, map) {
    const shape = layer.pm?.getShape?.() || '';
    let text = '';

    if (shape === 'Line' || shape === 'Polyline') {
        text = fmtDistance(polylineDistance(layer.getLatLngs(), map));
    } else if (shape === 'Polygon' || shape === 'Rectangle') {
        const ring = layer.getLatLngs()[0] || layer.getLatLngs();
        text = `${fmtArea(polygonAreaSqMeters(ring))} · perimeter ${fmtDistance(polylineDistance([...ring, ring[0]], map))}`;
    } else if (shape === 'Circle') {
        const r = layer.getRadius();
        text = `radius ${fmtDistance(r)} · area ${fmtArea(Math.PI * r * r)}`;
    } else if (shape === 'Marker' || shape === 'CircleMarker') {
        const ll = layer.getLatLng();
        text = `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
    }

    if (text) {
        layer.bindTooltip(text, {
            permanent: true, direction: 'center', className: 'measure-label',
        }).openTooltip();
    }
}

export function initMeasureTool(map) {
    if (!map.pm) {
        console.warn('leaflet-geoman not loaded');
        return;
    }

    map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawCircleMarker: false,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: true,
        drawText: false,
        cutPolygon: false,
        rotateMode: false,
        editMode: true,
        dragMode: true,
        removalMode: true,
    });

    map.pm.setPathOptions({
        color: '#00d4ff',
        fillColor: '#00d4ff',
        fillOpacity: 0.15,
        weight: 2,
    });

    map.on('pm:create', (e) => attachLabel(e.layer, map));
    map.on('pm:edit', (e) => {
        e.layer.unbindTooltip();
        attachLabel(e.layer, map);
    });
}

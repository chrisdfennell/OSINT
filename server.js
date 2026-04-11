require('dotenv').config();
const express = require('express');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── Flight Data ──
// Primary: OpenSky Network /states/all — returns ALL aircraft globally in one call.
// Enrichment: FR24 API adds registration, type, route on click.

const FR24_TOKEN = process.env.FR24_API_TOKEN || '';
const FR24_BASE = 'https://fr24api.flightradar24.com/api';
const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const OPENSKY_REFRESH = 60000; // 60s — anonymous budget is ~100 calls/day, registered is ~1000/day

let flightCache = { ac: [], ts: 0 };

// ── Military detection ──

const MILITARY_TYPES = new Set([
    'F16', 'F15', 'F15E', 'F15C', 'F18E', 'F18F', 'FA18', 'F22', 'F35A', 'F35B', 'F35C',
    'A10', 'EF2K', 'EUFI', 'RFAL', 'GR4', 'GR4T', 'HAWK', 'T45', 'JAS39',
    'SU27', 'SU30', 'SU34', 'SU35', 'MG29', 'MG31', 'JF17', 'J10', 'J20', 'F4', 'F5',
    'HURR', 'SPIT', 'TYPH',
    'C130', 'C30J', 'C17', 'C5M', 'C5', 'C2', 'C12', 'C27J',
    'A400', 'A400M', 'KC10', 'KC35', 'KC46', 'AN12', 'AN26', 'IL76', 'CN35',
    'E3TF', 'E3CF', 'E6B', 'E8', 'E2', 'P8', 'P8A', 'P3', 'RC35',
    'U2', 'RQ4', 'MQ9', 'MQ1',
    'B52', 'B1B', 'B2',
    'H60', 'UH60', 'S70', 'AH64', 'CH47', 'V22', 'NH90', 'H64', 'H1',
    'LYNX', 'WILD', 'S61', 'AS32',
    'T38', 'T6', 'PC21', 'PC9', 'TUCA', 'PC7', 'T1', 'T2',
]);

const MILITARY_OPERATORS = new Set([
    'RCH', 'AIO', 'RFF', 'CNV', 'PAT', 'PLF',
    'GAF', 'FAF', 'RFR', 'BAF', 'NAF', 'DAF', 'HAF', 'PAF', 'IAM', 'RRR',
    'SUI', 'BEL', 'NLD', 'DNK', 'NOR', 'SWE', 'FIN', 'POL', 'CZE', 'ROU', 'BGR',
    'HUN', 'ESP', 'PRT', 'GRC', 'TUR', 'CTM',
    'IAF', 'CHN', 'JAF', 'ROK', 'KAF', 'AUI', 'NZM', 'TAI', 'SGP',
    'UAE', 'RSF', 'ISR', 'JOR', 'KWT', 'QAF', 'BAH', 'OMN',
    'MMF', 'CFC', 'AME', 'BRF', 'ARG', 'CLF', 'COF',
]);

function isMilitary(ac) {
    const t = (ac.t || '').toUpperCase();
    if (t && MILITARY_TYPES.has(t)) return true;
    const op = (ac.ownOp || '').toUpperCase();
    if (op && MILITARY_OPERATORS.has(op)) return true;
    const sq = parseInt(ac.squawk, 10);
    if (sq >= 4400 && sq <= 4477) return true;
    if (sq >= 5100 && sq <= 5177) return true;
    return false;
}

// ── OpenSky fetch ──
// Response: { states: [ [icao24, callsign, origin_country, time_pos, last_contact,
//   lon, lat, baro_alt(m), on_ground, velocity(m/s), true_track, vert_rate(m/s),
//   sensors, geo_alt(m), squawk, spi, position_source, category], ... ] }

const M_TO_FT = 3.28084;
const MS_TO_KTS = 1.94384;

function parseOpenSkyStates(states) {
    const aircraft = [];
    for (const s of states) {
        const lat = s[6];
        const lon = s[5];
        if (lat == null || lon == null) continue;

        const ac = {
            hex: s[0],
            flight: s[1]?.trim() || '',
            lat,
            lon,
            alt_baro: s[8] ? 'ground' : (s[7] != null ? Math.round(s[7] * M_TO_FT) : null),
            gs: s[9] != null ? Math.round(s[9] * MS_TO_KTS) : null,
            track: s[10],
            baro_rate: s[11] != null ? Math.round(s[11] * M_TO_FT * 60) : null,
            squawk: s[14] || '',
            on_ground: s[8],
            country: s[2] || '',
            category: s[17] || 0,
        };

        ac.military = isMilitary(ac);
        aircraft.push(ac);
    }
    return aircraft;
}

let openskyBackoff = OPENSKY_REFRESH;

async function refreshFlightCache() {
    try {
        const res = await fetch(OPENSKY_URL);
        if (res.status === 429) {
            openskyBackoff = Math.min(openskyBackoff * 2, 600000); // back off up to 10 min
            console.warn(`OpenSky rate limited, backing off to ${openskyBackoff / 1000}s`);
            return;
        }
        if (!res.ok) throw new Error(`OpenSky ${res.status}`);

        const data = await res.json();
        const states = data.states || [];
        const aircraft = parseOpenSkyStates(states);

        flightCache = { ac: aircraft, ts: Date.now() };
        openskyBackoff = OPENSKY_REFRESH; // reset on success
        console.log(`Flights: ${aircraft.length} aircraft via OpenSky`);
    } catch (err) {
        console.error('Flight cache error:', err.message);
    }
}

// Use dynamic interval with backoff
function scheduleFlightRefresh() {
    refreshFlightCache().then(() => {
        setTimeout(scheduleFlightRefresh, openskyBackoff);
    });
}
scheduleFlightRefresh();

// ── FR24 enrichment (on-demand per click) ──

const fr24Cache = new Map();
const FR24_ENRICH_TTL = 120000;
let fr24Fetching = false;

async function enrichFromFR24(bounds) {
    if (!FR24_TOKEN || fr24Fetching) return;
    fr24Fetching = true;

    try {
        const res = await fetch(`${FR24_BASE}/live/flight-positions/full?bounds=${bounds}&limit=20`, {
            headers: {
                'Authorization': `Bearer ${FR24_TOKEN}`,
                'Accept': 'application/json',
                'Accept-Version': 'v1',
            },
        });

        if (!res.ok) return;

        const body = await res.json();
        for (const f of (body.data || [])) {
            if (!f.hex) continue;
            fr24Cache.set(f.hex.toLowerCase(), {
                reg: f.reg || '', type: f.type || '',
                operator: f.operating_as || '', airline: f.painted_as || '',
                orig: f.orig_iata || '', dest: f.dest_iata || '',
                flightNum: f.flight || '', callsign: f.callsign || '',
                eta: f.eta || '', ts: Date.now(),
            });
        }
    } catch (err) {
        console.error('FR24 enrich error:', err.message);
    } finally {
        fr24Fetching = false;
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [hex, v] of fr24Cache) {
        if (now - v.ts > FR24_ENRICH_TTL * 5) fr24Cache.delete(hex);
    }
}, 60000);

// ── Vessel (AIS) ──

const AISSTREAM_KEY = process.env.AISSTREAM_API_KEY || '';
const vesselCache = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [mmsi, v] of vesselCache) {
        if (now - v.ts > 600000) vesselCache.delete(mmsi);
    }
}, 60000);

function connectAISStream() {
    if (!AISSTREAM_KEY) { console.log('No AISSTREAM_API_KEY — vessel tracking disabled.'); return; }

    let ws, reconnectDelay = 5000;
    let lastMessage = Date.now();
    let heartbeatTimer;

    function open() {
        ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

        ws.on('open', () => {
            console.log('AISStream connected');
            reconnectDelay = 5000;
            lastMessage = Date.now();
            ws.send(JSON.stringify({
                APIkey: AISSTREAM_KEY,
                BoundingBoxes: [[[-90, -180], [90, 180]]],
                FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport'],
            }));

            // Heartbeat: if no messages for 30s, connection is stale — reconnect
            clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                if (Date.now() - lastMessage > 30000) {
                    console.warn('AISStream stale (no data 30s), reconnecting...');
                    clearInterval(heartbeatTimer);
                    try { ws.close(); } catch {}
                }
            }, 10000);
        });

        ws.on('message', (raw) => {
            lastMessage = Date.now();
            try {
                const msg = JSON.parse(raw);
                const meta = msg.MetaData || {};
                const mmsi = meta.MMSI;
                if (!mmsi) return;
                const existing = vesselCache.get(mmsi) || {};

                if (msg.MessageType === 'PositionReport' || msg.MessageType === 'StandardClassBPositionReport') {
                    const pos = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport || {};
                    vesselCache.set(mmsi, {
                        ...existing, mmsi,
                        name: meta.ShipName?.trim() || existing.name || '',
                        lat: meta.latitude ?? pos.Latitude, lon: meta.longitude ?? pos.Longitude,
                        sog: pos.Sog ?? existing.sog, cog: pos.Cog ?? existing.cog,
                        heading: pos.TrueHeading ?? existing.heading,
                        navStatus: pos.NavigationalStatus ?? existing.navStatus,
                        type: existing.type || 0, callsign: existing.callsign || '',
                        dest: existing.dest || '', ts: Date.now(),
                    });
                } else if (msg.MessageType === 'ShipStaticData') {
                    const sd = msg.Message?.ShipStaticData || {};
                    vesselCache.set(mmsi, {
                        ...existing, mmsi,
                        name: sd.Name?.trim() || meta.ShipName?.trim() || existing.name || '',
                        type: sd.Type || existing.type || 0,
                        callsign: sd.CallSign?.trim() || existing.callsign || '',
                        dest: sd.Destination?.trim() || existing.dest || '',
                        imo: sd.ImoNumber || existing.imo,
                        ts: existing.ts || Date.now(),
                    });
                }
            } catch { /* skip */ }
        });

        ws.on('close', () => { clearInterval(heartbeatTimer); setTimeout(open, reconnectDelay); reconnectDelay = Math.min(reconnectDelay * 2, 60000); });
        ws.on('error', (err) => { console.error('AISStream error:', err.message); ws.close(); });
    }
    open();
}

connectAISStream();

// ── Photo proxy ──

const photoCache = new Map();
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// ── API Routes ──

app.get('/health', (req, res) => {
    res.json({
        status: 'ok', uptime: process.uptime(),
        flights: flightCache.ac.length,
        fr24Enriched: fr24Cache.size, vessels: vesselCache.size,
    });
});

app.get('/api/flights/all', (req, res) => {
    const enriched = flightCache.ac.map(ac => {
        const detail = fr24Cache.get(ac.hex?.toLowerCase());
        if (!detail || Date.now() - detail.ts > FR24_ENRICH_TTL) return ac;
        return {
            ...ac,
            r: detail.reg || ac.r || '',
            t: detail.type || ac.t || '',
            ownOp: detail.operator || ac.ownOp || '',
            airline: detail.airline || '',
            orig: detail.orig || '',
            dest: detail.dest || '',
            flightNum: detail.flightNum || '',
            military: ac.military || (detail.type && MILITARY_TYPES.has(detail.type.toUpperCase())),
        };
    });
    res.json({ ac: enriched, ts: flightCache.ts, total: enriched.length, fr24: !!FR24_TOKEN });
});

app.get('/api/flights/enrich', async (req, res) => {
    const bounds = req.query.bounds;
    if (!bounds || !FR24_TOKEN) return res.json({ enriched: 0, available: !!FR24_TOKEN });
    await enrichFromFR24(bounds);
    res.json({ enriched: fr24Cache.size });
});

app.get('/api/flights/photo/:hex', async (req, res) => {
    const hex = req.params.hex.toLowerCase();
    const cached = photoCache.get(hex);
    if (cached && Date.now() - cached.ts < 3600000) {
        if (cached.url) return res.redirect(cached.url);
        return res.set('Content-Type', 'image/gif').send(TRANSPARENT_GIF);
    }
    try {
        const response = await fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`);
        if (!response.ok) throw new Error('');
        const data = await response.json();
        const url = data.photos?.[0]?.thumbnail_large?.src || data.photos?.[0]?.thumbnail?.src || null;
        photoCache.set(hex, { url, ts: Date.now() });
        if (url) res.redirect(url);
        else res.set('Content-Type', 'image/gif').send(TRANSPARENT_GIF);
    } catch {
        photoCache.set(hex, { url: null, ts: Date.now() });
        res.set('Content-Type', 'image/gif').send(TRANSPARENT_GIF);
    }
});

app.get('/api/earthquakes', async (req, res) => {
    try {
        const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/fires', async (req, res) => {
    try {
        const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=200');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/vessels/all', (req, res) => {
    const vessels = Array.from(vesselCache.values());
    res.json({ vessels, total: vessels.length, active: !!AISSTREAM_KEY });
});

app.get('/api/config/ais', (req, res) => res.json({ active: !!AISSTREAM_KEY, count: vesselCache.size }));

app.get('/api/weather/rainviewer', async (req, res) => {
    try {
        const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/config/owm', (req, res) => res.json({ key: process.env.OWM_API_KEY || '' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Hub running at http://localhost:${PORT}`);
    console.log(`Flights: OpenSky Network (global)${FR24_TOKEN ? ' + FR24 enrichment' : ''}`);
    console.log(`Vessels: ${AISSTREAM_KEY ? 'AISStream.io' : 'disabled'}`);
});

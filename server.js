require('dotenv').config();
const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const AdmZip = require('adm-zip');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── Flight Data ──
// Primary: adsb.lol /v2/point — rich data (reg, type, operator, category).
// Queried from ~31 hotspots worldwide and merged server-side (~8s refresh).
// Enrichment: FR24 API adds route/airline/flight# on click.

const FR24_TOKEN = process.env.FR24_API_TOKEN || '';
const FR24_BASE = 'https://fr24api.flightradar24.com/api';
const ADSB_BASE = 'https://api.adsb.lol/v2';
const FLIGHT_REFRESH = 8000;
const HOTSPOT_RADIUS_NM = 500;

const FLIGHT_HOTSPOTS = [
    // North America
    { lat: 40, lon: -74 },   { lat: 34, lon: -118 },  { lat: 41, lon: -88 },
    { lat: 33, lon: -84 },   { lat: 47, lon: -122 },  { lat: 30, lon: -97 },
    { lat: 25, lon: -80 },   { lat: 49, lon: -123 },  { lat: 45, lon: -74 },
    // Europe
    { lat: 51, lon: 0 },     { lat: 48, lon: 2 },     { lat: 50, lon: 10 },
    { lat: 41, lon: 12 },    { lat: 40, lon: -4 },    { lat: 59, lon: 18 },
    { lat: 52, lon: 21 },
    // Middle East / Africa
    { lat: 25, lon: 55 },    { lat: 33, lon: 44 },    { lat: 6, lon: 3 },
    { lat: -1, lon: 37 },
    // Asia
    { lat: 35, lon: 140 },   { lat: 22, lon: 114 },   { lat: 31, lon: 121 },
    { lat: 37, lon: 127 },   { lat: 13, lon: 100 },   { lat: 1, lon: 104 },
    { lat: 28, lon: 77 },
    // Oceania / South America
    { lat: -33, lon: 151 },  { lat: -23, lon: -46 },  { lat: 19, lon: -99 },
    // Russia
    { lat: 55, lon: 37 },
];

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

// ── adsb.lol fetch (hotspot grid) ──

async function refreshFlightCache() {
    try {
        const seen = new Set();
        const allAircraft = [];

        const results = await Promise.allSettled(
            FLIGHT_HOTSPOTS.map(async (pt) => {
                const res = await fetch(`${ADSB_BASE}/point/${pt.lat}/${pt.lon}/${HOTSPOT_RADIUS_NM}`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.ac || [];
            })
        );

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            for (const ac of result.value) {
                if (!ac.hex || seen.has(ac.hex)) continue;
                seen.add(ac.hex);
                if (!ac.military) ac.military = isMilitary(ac);
                allAircraft.push(ac);
            }
        }

        flightCache = { ac: allAircraft, ts: Date.now() };
        console.log(`Flights: ${allAircraft.length} aircraft from ${FLIGHT_HOTSPOTS.length} hotspots`);
    } catch (err) {
        console.error('Flight cache error:', err.message);
    }
}

refreshFlightCache();
setInterval(refreshFlightCache, FLIGHT_REFRESH);

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

// ── News ticker: aggregated RSS headlines ──

const NEWS_FEEDS = [
    { source: 'BBC',        url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { source: 'NPR',        url: 'https://feeds.npr.org/1004/rss.xml' },
    { source: 'Guardian',   url: 'https://www.theguardian.com/world/rss' },
    { source: 'Reuters',    url: 'https://www.reutersagency.com/feed/?best-topics=international-news&post_type=best' },
    { source: 'AP',         url: 'https://rsshub.app/apnews/topics/apf-topnews' },
];
const NEWS_REFRESH = 5 * 60 * 1000;
const NEWS_MAX_ITEMS = 60;

let newsCache = { items: [], ts: 0 };

function decodeEntities(s) {
    return s
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function stripTags(s) { return s.replace(/<[^>]+>/g, '').trim(); }

function extractTag(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
    if (!m) return '';
    let val = m[1].trim();
    const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
    if (cdata) val = cdata[1];
    return decodeEntities(stripTags(val));
}

function parseRss(xml, source) {
    const items = [];
    const matches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const block of matches) {
        const title = extractTag(block, 'title');
        const link = extractTag(block, 'link');
        const pub = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
        if (!title) continue;
        const ts = pub ? Date.parse(pub) : NaN;
        items.push({
            source, title,
            url: link,
            ts: isFinite(ts) ? ts : Date.now(),
        });
    }
    return items;
}

async function refreshNewsCache() {
    const results = await Promise.allSettled(
        NEWS_FEEDS.map(async (f) => {
            const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) throw new Error(`${f.source} ${r.status}`);
            return parseRss(await r.text(), f.source);
        })
    );

    const merged = [];
    const seen = new Set();
    for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const item of r.value) {
            const key = item.url || item.title;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(item);
        }
    }

    merged.sort((a, b) => b.ts - a.ts);
    newsCache = { items: merged.slice(0, NEWS_MAX_ITEMS), ts: Date.now() };
    console.log(`News ticker: ${newsCache.items.length} items from ${results.filter(r=>r.status==='fulfilled').length}/${NEWS_FEEDS.length} feeds`);
}

refreshNewsCache();
setInterval(refreshNewsCache, NEWS_REFRESH);

// ── Blitzortung lightning (real-time strikes) ──
// Community-reversed WebSocket: ws1..ws8.blitzortung.org. Handshake is a JSON
// {"a":111} message, then the server pushes LZW-compressed JSON strikes.

const LIGHTNING_RETENTION_MS = 5 * 60 * 1000;
const LIGHTNING_MAX = 2000;
const lightningRecent = []; // ring buffer of { time, lat, lon, alt, receivedAt }
const lightningClients = new Set(); // SSE response objects

function blitzortungDecode(s) {
    // LZW variant used by Blitzortung's public WS feed.
    const dict = {};
    const chars = s.split('');
    let prev = chars[0];
    let current = prev;
    const out = [prev];
    let code = 256;
    for (let i = 1; i < chars.length; i++) {
        const ccode = chars[i].charCodeAt(0);
        const entry = ccode < 256 ? chars[i] : (dict[ccode] || (current + prev));
        out.push(entry);
        prev = entry.charAt(0);
        dict[code++] = current + prev;
        current = entry;
    }
    return out.join('');
}

function pushStrike(strike) {
    lightningRecent.push(strike);
    if (lightningRecent.length > LIGHTNING_MAX) lightningRecent.shift();

    const line = `data: ${JSON.stringify(strike)}\n\n`;
    for (const res of lightningClients) {
        try { res.write(line); } catch { /* client gone */ }
    }
}

function pruneStrikes() {
    const cutoff = Date.now() - LIGHTNING_RETENTION_MS;
    while (lightningRecent.length && lightningRecent[0].receivedAt < cutoff) {
        lightningRecent.shift();
    }
}
setInterval(pruneStrikes, 30000);

function connectBlitzortung() {
    let ws;
    let reconnectDelay = 5000;
    const hosts = ['ws1', 'ws2', 'ws3', 'ws4', 'ws5', 'ws6', 'ws7', 'ws8'];
    let hostIdx = 0;

    function open() {
        const host = hosts[hostIdx % hosts.length];
        hostIdx++;
        ws = new WebSocket(`wss://${host}.blitzortung.org/`);

        ws.on('open', () => {
            console.log(`Blitzortung connected via ${host}`);
            reconnectDelay = 5000;
            ws.send(JSON.stringify({ a: 111 }));
        });

        ws.on('message', (raw) => {
            try {
                const decoded = blitzortungDecode(raw.toString());
                const msg = JSON.parse(decoded);
                if (typeof msg.lat !== 'number' || typeof msg.lon !== 'number') return;
                pushStrike({
                    time: msg.time,
                    lat: msg.lat,
                    lon: msg.lon,
                    alt: msg.alt || 0,
                    receivedAt: Date.now(),
                });
            } catch { /* skip malformed frame */ }
        });

        ws.on('close', () => {
            setTimeout(open, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 60000);
        });
        ws.on('error', (err) => {
            console.error('Blitzortung error:', err.message);
            try { ws.close(); } catch {}
        });
    }
    open();
}
connectBlitzortung();

// ── GDELT geolocated events ──
// Events CSV updates every 15 minutes. We fetch lastupdate.txt, download the
// export zip, and keep the most recent ~800 rows that have lat/lon.

const GDELT_LASTUPDATE = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const GDELT_REFRESH = 15 * 60 * 1000;
const GDELT_MAX_EVENTS = 800;

let gdeltCache = { events: [], ts: 0 };

async function refreshGdeltCache() {
    try {
        const idxRes = await fetch(GDELT_LASTUPDATE);
        if (!idxRes.ok) throw new Error(`lastupdate ${idxRes.status}`);
        const idxTxt = await idxRes.text();
        const url = idxTxt.split('\n')[0]?.trim().split(' ').pop();
        if (!url) throw new Error('no export url');

        const zipRes = await fetch(url);
        if (!zipRes.ok) throw new Error(`zip ${zipRes.status}`);
        const zipBuf = Buffer.from(await zipRes.arrayBuffer());

        const zip = new AdmZip(zipBuf);
        const entry = zip.getEntries()[0];
        if (!entry) throw new Error('empty zip');
        const csv = entry.getData().toString('utf-8');

        const events = [];
        for (const line of csv.split('\n')) {
            if (!line.trim()) continue;
            const c = line.split('\t');
            const lat = parseFloat(c[56]);
            const lon = parseFloat(c[57]);
            if (!isFinite(lat) || !isFinite(lon)) continue;

            events.push({
                id: c[0],
                date: c[1],
                eventCode: c[26],
                eventBaseCode: c[28],
                goldstein: parseFloat(c[30]) || 0,
                numMentions: parseInt(c[31], 10) || 0,
                numSources: parseInt(c[32], 10) || 0,
                numArticles: parseInt(c[33], 10) || 0,
                tone: parseFloat(c[34]) || 0,
                actor1: c[6] || c[5] || '',
                actor2: c[16] || c[15] || '',
                place: c[53] || '',
                countryCode: c[51] || '',
                lat, lon,
                sourceUrl: c[60] || '',
            });
            if (events.length >= GDELT_MAX_EVENTS) break;
        }

        gdeltCache = { events, ts: Date.now() };
        console.log(`GDELT: ${events.length} geolocated events`);
    } catch (err) {
        console.error('GDELT refresh error:', err.message);
    }
}

refreshGdeltCache();
setInterval(refreshGdeltCache, GDELT_REFRESH);

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

app.get('/api/cyclones', async (req, res) => {
    try {
        const r = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/geocode', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'missing q' });
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`;
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'OSINT-Hub/1.0',
                'Accept-Language': 'en',
            },
        });
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/iss', async (req, res) => {
    try {
        const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

// Propagated future ISS track: 3 orbits (~270 min) at one point every 3 min.
// wheretheiss.at positions endpoint caps at 10 timestamps/request, so we
// parallelize and cache the result for 10 minutes.
const ISS_TRACK_TTL = 10 * 60 * 1000;
const ISS_TRACK_ORBITS = 3;
const ISS_TRACK_STEP_SEC = 180;
const ISS_TRACK_POINTS = ISS_TRACK_ORBITS * 31; // ~92min/3min ≈ 31 points per orbit

let issTrackCache = { points: [], ts: 0 };

async function refreshIssTrack() {
    const now = Math.floor(Date.now() / 1000);
    const timestamps = [];
    for (let i = 1; i <= ISS_TRACK_POINTS; i++) {
        timestamps.push(now + i * ISS_TRACK_STEP_SEC);
    }

    const chunks = [];
    for (let i = 0; i < timestamps.length; i += 10) chunks.push(timestamps.slice(i, i + 10));

    try {
        const results = await Promise.all(chunks.map(async (ts) => {
            const r = await fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${ts.join(',')}`);
            if (!r.ok) throw new Error(`positions ${r.status}`);
            return r.json();
        }));
        const points = results.flat().map(p => ({
            t: p.timestamp, lat: p.latitude, lon: p.longitude,
        }));
        issTrackCache = { points, ts: Date.now() };
    } catch (err) {
        console.error('ISS track refresh error:', err.message);
    }
}

app.get('/api/iss/track', async (req, res) => {
    if (!issTrackCache.points.length || Date.now() - issTrackCache.ts > ISS_TRACK_TTL) {
        await refreshIssTrack();
    }
    res.json(issTrackCache);
});

// Air quality: Open-Meteo gridded AQ model, sampled at ~100 major cities
// worldwide. No key required. Refreshed every 30 min.
// Covers all UN-member national capitals plus a handful of major non-capital
// cities (NYC, LA, Mumbai, Shanghai, etc.) and Butler, PA per request.
const AIR_QUALITY_CITIES = [
    // ── USA regional (non-capital but useful) ──
    ['Washington DC', 38.91, -77.04], ['New York',     40.71,  -74.01],
    ['Los Angeles',   34.05, -118.24], ['Chicago',     41.88,  -87.63],
    ['Houston',       29.76,  -95.37], ['Phoenix',     33.45, -112.07],
    ['Denver',        39.74, -104.99], ['Seattle',     47.61, -122.33],
    ['Miami',         25.76,  -80.19], ['Atlanta',     33.75,  -84.39],
    ['Pittsburgh',    40.44,  -79.99], ['Butler, PA',  40.86,  -79.90],
    ['Boston',        42.36,  -71.06],

    // ── North America capitals ──
    ['Ottawa',         45.42, -75.70], ['Mexico City',  19.43, -99.13],
    ['Havana',         23.13, -82.38], ['Kingston',     17.99, -76.80],
    ['Port-au-Prince', 18.54, -72.34], ['Santo Domingo',18.48, -69.93],
    ['Guatemala City', 14.63, -90.51], ['San Salvador', 13.69, -89.19],
    ['Tegucigalpa',    14.07, -87.19], ['Managua',      12.14, -86.27],
    ['San José, CR',    9.93, -84.08], ['Panama City',   8.98, -79.52],
    ['Nassau',         25.07, -77.34], ['Bridgetown',   13.10, -59.61],
    ['Port of Spain',  10.66, -61.51], ['Belmopan',     17.25, -88.76],

    // ── South America capitals + majors ──
    ['Brasília',      -15.79, -47.88], ['São Paulo',   -23.55, -46.63],
    ['Rio de Janeiro',-22.91, -43.17], ['Buenos Aires',-34.60, -58.38],
    ['Lima',          -12.05, -77.04], ['Bogotá',        4.71, -74.07],
    ['Santiago',      -33.45, -70.67], ['Caracas',      10.48, -66.90],
    ['Quito',          -0.18, -78.47], ['La Paz',      -16.50, -68.15],
    ['Asunción',      -25.26, -57.58], ['Montevideo',  -34.90, -56.19],
    ['Georgetown',      6.80, -58.16], ['Paramaribo',    5.85, -55.20],

    // ── Europe capitals ──
    ['London',         51.51,  -0.13], ['Paris',        48.86,   2.35],
    ['Berlin',         52.52,  13.41], ['Madrid',       40.42,  -3.70],
    ['Rome',           41.90,  12.50], ['Moscow',       55.75,  37.62],
    ['Ankara',         39.93,  32.86], ['Amsterdam',    52.37,   4.89],
    ['Brussels',       50.85,   4.35], ['Bern',         46.95,   7.45],
    ['Vienna',         48.21,  16.37], ['Warsaw',       52.23,  21.01],
    ['Prague',         50.08,  14.44], ['Budapest',     47.50,  19.04],
    ['Bratislava',     48.15,  17.11], ['Ljubljana',    46.06,  14.51],
    ['Zagreb',         45.81,  15.98], ['Sarajevo',     43.86,  18.41],
    ['Belgrade',       44.79,  20.45], ['Podgorica',    42.44,  19.26],
    ['Skopje',         41.99,  21.43], ['Tirana',       41.33,  19.82],
    ['Pristina',       42.67,  21.17], ['Sofia',        42.70,  23.32],
    ['Bucharest',      44.43,  26.10], ['Chișinău',     47.00,  28.86],
    ['Kyiv',           50.45,  30.52], ['Minsk',        53.90,  27.57],
    ['Vilnius',        54.69,  25.28], ['Riga',         56.95,  24.11],
    ['Tallinn',        59.44,  24.75], ['Helsinki',     60.17,  24.94],
    ['Stockholm',      59.33,  18.07], ['Oslo',         59.91,  10.75],
    ['Copenhagen',     55.68,  12.57], ['Reykjavík',    64.15, -21.94],
    ['Dublin',         53.35,  -6.26], ['Lisbon',       38.72,  -9.14],
    ['Athens',         37.98,  23.73], ['Nicosia',      35.17,  33.37],
    ['Valletta',       35.90,  14.51], ['Luxembourg',   49.61,   6.13],
    ['Andorra la Vella',42.51,  1.52], ['Monaco',       43.74,   7.42],
    ['Vaduz',          47.14,   9.52], ['San Marino',   43.94,  12.46],

    // ── Middle East capitals ──
    ['Jerusalem',      31.78,  35.22], ['Amman',        31.95,  35.91],
    ['Beirut',         33.89,  35.50], ['Damascus',     33.51,  36.29],
    ['Baghdad',        33.31,  44.36], ['Riyadh',       24.71,  46.68],
    ['Abu Dhabi',      24.45,  54.38], ['Muscat',       23.59,  58.38],
    ['Sanaʽa',         15.37,  44.19], ['Doha',         25.29,  51.53],
    ['Manama',         26.22,  50.58], ['Kuwait City',  29.38,  47.99],
    ['Tehran',         35.69,  51.39], ['Dubai',        25.20,  55.27],

    // ── Africa capitals ──
    ['Cairo',          30.04,  31.24], ['Rabat',        34.02,  -6.83],
    ['Algiers',        36.75,   3.06], ['Tunis',        36.81,  10.18],
    ['Tripoli',        32.89,  13.19], ['Khartoum',     15.50,  32.56],
    ['Juba',            4.85,  31.58], ['Asmara',       15.33,  38.93],
    ['Addis Ababa',     9.03,  38.74], ['Djibouti',     11.57,  43.15],
    ['Mogadishu',       2.05,  45.32], ['Nairobi',      -1.29,  36.82],
    ['Kampala',         0.35,  32.58], ['Kigali',       -1.95,  30.06],
    ['Bujumbura',      -3.38,  29.36], ['Dodoma',       -6.17,  35.74],
    ['Lusaka',        -15.39,  28.32], ['Harare',      -17.83,  31.05],
    ['Maputo',        -25.97,  32.58], ['Lilongwe',    -13.96,  33.79],
    ['Antananarivo',  -18.88,  47.51], ['Port Louis',  -20.17,  57.50],
    ['Moroni',        -11.70,  43.26], ['Victoria, SC',  -4.62,  55.45],
    ['Pretoria',      -25.75,  28.19], ['Cape Town',   -33.93,  18.42],
    ['Maseru',        -29.32,  27.48], ['Mbabane',     -26.32,  31.14],
    ['Gaborone',      -24.66,  25.91], ['Windhoek',    -22.56,  17.08],
    ['Luanda',         -8.84,  13.23], ['Kinshasa',     -4.44,  15.27],
    ['Brazzaville',    -4.27,  15.28], ['Bangui',        4.36,  18.55],
    ['Yaoundé',         3.85,  11.50], ['Libreville',    0.40,   9.45],
    ['Malabo',          3.75,   8.78], ['São Tomé',      0.34,   6.73],
    ['Abuja',           9.06,   7.49], ['Porto-Novo',    6.49,   2.60],
    ['Lomé',            6.14,   1.21], ['Accra',         5.60,  -0.19],
    ['Yamoussoukro',    6.83,  -5.28], ['Monrovia',      6.30, -10.80],
    ['Freetown',        8.48, -13.23], ['Conakry',       9.64, -13.58],
    ['Bissau',         11.86, -15.60], ['Banjul',       13.45, -16.58],
    ['Dakar',          14.69, -17.45], ['Nouakchott',   18.08, -15.97],
    ['Bamako',         12.64,  -8.00], ['Ouagadougou',  12.37,  -1.52],
    ['Niamey',         13.51,   2.11], ['N\'Djamena',   12.13,  15.06],
    ['Praia',          14.92, -23.51], ['Lagos',         6.52,   3.38],
    ['Casablanca',     33.57,  -7.59], ['Johannesburg',-26.20,  28.04],

    // ── Central / South Asia ──
    ['Kabul',          34.53,  69.17], ['Islamabad',    33.68,  73.05],
    ['New Delhi',      28.61,  77.21], ['Kathmandu',    27.72,  85.32],
    ['Thimphu',        27.47,  89.64], ['Dhaka',        23.81,  90.41],
    ['Colombo',         6.93,  79.86], ['Malé',          4.17,  73.51],
    ['Tashkent',       41.31,  69.28], ['Astana',       51.17,  71.45],
    ['Bishkek',        42.87,  74.59], ['Dushanbe',     38.54,  68.78],
    ['Ashgabat',       37.96,  58.33], ['Yerevan',      40.18,  44.51],
    ['Tbilisi',        41.72,  44.79], ['Baku',         40.41,  49.87],
    ['Mumbai',         19.08,  72.88], ['Kolkata',      22.57,  88.36],
    ['Chennai',        13.08,  80.27], ['Bangalore',    12.97,  77.59],
    ['Karachi',        24.86,  67.01], ['Lahore',       31.55,  74.34],

    // ── East / Southeast Asia ──
    ['Beijing',        39.90, 116.41], ['Shanghai',     31.23, 121.47],
    ['Chongqing',      29.56, 106.55], ['Guangzhou',    23.13, 113.26],
    ['Urumqi',         43.83,  87.62], ['Hong Kong',    22.32, 114.17],
    ['Taipei',         25.03, 121.57], ['Tokyo',        35.68, 139.76],
    ['Seoul',          37.57, 126.98], ['Pyongyang',    39.02, 125.75],
    ['Ulaanbaatar',    47.89, 106.91], ['Hanoi',        21.03, 105.85],
    ['Ho Chi Minh',    10.82, 106.63], ['Vientiane',    17.97, 102.60],
    ['Phnom Penh',     11.55, 104.92], ['Bangkok',      13.76, 100.50],
    ['Naypyidaw',      19.76,  96.08], ['Kuala Lumpur',  3.14, 101.69],
    ['Singapore',       1.35, 103.82], ['Bandar Seri Begawan', 4.90, 114.94],
    ['Jakarta',        -6.21, 106.85], ['Dili',         -8.56, 125.58],
    ['Manila',         14.60, 120.98],

    // ── Oceania ──
    ['Canberra',      -35.28, 149.13], ['Sydney',      -33.87, 151.21],
    ['Melbourne',     -37.81, 144.96], ['Perth',       -31.95, 115.86],
    ['Brisbane',      -27.47, 153.03], ['Wellington',  -41.29, 174.78],
    ['Auckland',      -36.85, 174.76], ['Port Moresby', -9.44, 147.18],
    ['Suva',          -18.14, 178.44], ['Honiara',      -9.43, 159.96],
    ['Port Vila',     -17.73, 168.32], ['Apia',         -13.83,-171.76],
    ['Nukuʽalofa',    -21.14,-175.21], ['Tarawa',         1.33, 172.98],
    ['Majuro',          7.09, 171.38], ['Palikir',        6.92, 158.16],
    ['Ngerulmud',       7.50, 134.62], ['Funafuti',      -8.52, 179.20],
    ['Yaren',          -0.55, 166.92],

    // ── Russia regional ──
    ['St Petersburg', 59.93,  30.36], ['Novosibirsk',   55.03,  82.92],
    ['Yekaterinburg', 56.84,  60.60], ['Vladivostok',   43.12, 131.89],
];
const AIR_QUALITY_REFRESH = 30 * 60 * 1000;

let airQualityCache = { stations: [], ts: 0 };

function aqiCategory(aqi) {
    if (aqi == null) return 'unknown';
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'sensitive';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'very-unhealthy';
    return 'hazardous';
}

async function refreshAirQuality() {
    const out = [];
    const batchSize = 50;
    for (let i = 0; i < AIR_QUALITY_CITIES.length; i += batchSize) {
        const batch = AIR_QUALITY_CITIES.slice(i, i + batchSize);
        const lats = batch.map(c => c[1]).join(',');
        const lons = batch.map(c => c[2]).join(',');
        try {
            const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=pm2_5,us_aqi`;
            const r = await fetch(url);
            if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
            const body = await r.json();
            const arr = Array.isArray(body) ? body : [body];
            for (let j = 0; j < batch.length; j++) {
                const city = batch[j];
                const resp = arr[j];
                if (!resp?.current) continue;
                const aqi = resp.current.us_aqi;
                out.push({
                    name: city[0], lat: city[1], lon: city[2],
                    pm25: resp.current.pm2_5 ?? null,
                    aqi: aqi ?? null,
                    category: aqiCategory(aqi),
                    time: resp.current.time,
                });
            }
        } catch (err) {
            console.error('Open-Meteo AQ batch error:', err.message);
        }
    }
    airQualityCache = { stations: out, ts: Date.now() };
    console.log(`Air quality: ${out.length}/${AIR_QUALITY_CITIES.length} cities`);
}
refreshAirQuality();
setInterval(refreshAirQuality, AIR_QUALITY_REFRESH);

// Submarine cables: TeleGeography GeoJSON. Rarely changes, so cache 24h.
let cablesCache = { data: null, ts: 0 };
const CABLES_TTL = 24 * 60 * 60 * 1000;

app.get('/api/airquality', (req, res) => {
    res.json({ stations: airQualityCache.stations, ts: airQualityCache.ts, total: airQualityCache.stations.length });
});

app.get('/api/cables', async (req, res) => {
    if (cablesCache.data && Date.now() - cablesCache.ts < CABLES_TTL) {
        return res.json(cablesCache.data);
    }
    try {
        const r = await fetch('https://www.submarinecablemap.com/api/v3/cable/cable-geo.json');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        cablesCache = { data: await r.json(), ts: Date.now() };
        res.json(cablesCache.data);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/volcanoes', async (req, res) => {
    try {
        const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open&limit=200');
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        res.json(await r.json());
    } catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/vessels/all', (req, res) => {
    const vessels = Array.from(vesselCache.values());
    res.json({ vessels, total: vessels.length, active: !!AISSTREAM_KEY });
});

app.get('/api/config/ais', (req, res) => res.json({ active: !!AISSTREAM_KEY, count: vesselCache.size }));

app.get('/api/lightning/recent', (req, res) => {
    res.json({ strikes: lightningRecent, retentionMs: LIGHTNING_RETENTION_MS });
});

app.get('/api/lightning/stream', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');

    lightningClients.add(res);
    const keepalive = setInterval(() => {
        try { res.write(': ping\n\n'); } catch {}
    }, 25000);

    req.on('close', () => {
        clearInterval(keepalive);
        lightningClients.delete(res);
    });
});

app.get('/api/news', (req, res) => {
    res.json({ items: newsCache.items, ts: newsCache.ts, total: newsCache.items.length });
});

app.get('/api/gdelt', (req, res) => {
    res.json({ events: gdeltCache.events, ts: gdeltCache.ts, total: gdeltCache.events.length });
});

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

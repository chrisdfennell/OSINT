const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── Flight Data: Global Cache ──
// Fetches from ~30 strategic points worldwide, deduplicates, caches server-side.
// Frontend just calls /api/flights/all - instant response from cache.

const ADSB_BASE = 'https://api.adsb.lol/v2';
const FLIGHT_HOTSPOTS = [
    // North America
    { lat: 40, lon: -74 },    // NYC
    { lat: 34, lon: -118 },   // LA
    { lat: 41, lon: -88 },    // Chicago
    { lat: 33, lon: -84 },    // Atlanta
    { lat: 47, lon: -122 },   // Seattle
    { lat: 30, lon: -97 },    // Texas
    { lat: 25, lon: -80 },    // Miami
    { lat: 49, lon: -123 },   // Vancouver
    { lat: 45, lon: -74 },    // Montreal
    // Europe
    { lat: 51, lon: 0 },      // London
    { lat: 48, lon: 2 },      // Paris
    { lat: 50, lon: 10 },     // Germany
    { lat: 41, lon: 12 },     // Italy
    { lat: 40, lon: -4 },     // Spain
    { lat: 59, lon: 18 },     // Scandinavia
    { lat: 52, lon: 21 },     // Poland
    // Middle East / Africa
    { lat: 25, lon: 55 },     // Dubai
    { lat: 33, lon: 44 },     // Iraq
    { lat: 6, lon: 3 },       // West Africa
    { lat: -1, lon: 37 },     // East Africa
    // Asia
    { lat: 35, lon: 140 },    // Tokyo
    { lat: 22, lon: 114 },    // Hong Kong
    { lat: 31, lon: 121 },    // Shanghai
    { lat: 37, lon: 127 },    // Seoul
    { lat: 13, lon: 100 },    // Bangkok
    { lat: 1, lon: 104 },     // Singapore
    { lat: 28, lon: 77 },     // India
    // Oceania / South America
    { lat: -33, lon: 151 },   // Sydney
    { lat: -23, lon: -46 },   // Sao Paulo
    { lat: 19, lon: -99 },    // Mexico City
    // Russia
    { lat: 55, lon: 37 },     // Moscow
];

let flightCache = { ac: [], ts: 0 };
const CACHE_TTL = 8000; // 8 seconds

async function refreshFlightCache() {
    try {
        const seen = new Set();
        const allAircraft = [];

        // Fetch all hotspots in parallel (server-side, no CORS)
        const results = await Promise.allSettled(
            FLIGHT_HOTSPOTS.map(async (pt) => {
                const url = `${ADSB_BASE}/point/${pt.lat}/${pt.lon}/250`;
                const res = await fetch(url);
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
                allAircraft.push(ac);
            }
        }

        flightCache = { ac: allAircraft, ts: Date.now() };
        console.log(`Flight cache refreshed: ${allAircraft.length} aircraft from ${FLIGHT_HOTSPOTS.length} hotspots`);
    } catch (err) {
        console.error('Flight cache refresh error:', err.message);
    }
}

// Initial fetch + refresh every 8 seconds
refreshFlightCache();
setInterval(refreshFlightCache, CACHE_TTL);

// ── API Routes ──

// All flights worldwide (from cache)
app.get('/api/flights/all', (req, res) => {
    res.json({ ac: flightCache.ac, ts: flightCache.ts, total: flightCache.ac.length });
});

// Point query (still available for zoomed-in views)
app.get('/api/flights/:lat/:lon/:radius', async (req, res) => {
    try {
        const { lat, lon, radius } = req.params;
        const url = `${ADSB_BASE}/point/${lat}/${lon}/${radius}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Upstream ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Flights proxy error:', err.message);
        res.status(502).json({ error: 'Failed to fetch flight data', detail: err.message });
    }
});

// USGS earthquake data
app.get('/api/earthquakes', async (req, res) => {
    try {
        const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Upstream ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Earthquakes proxy error:', err.message);
        res.status(502).json({ error: 'Failed to fetch earthquake data', detail: err.message });
    }
});

// NASA EONET fires
app.get('/api/fires', async (req, res) => {
    try {
        const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=200';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Upstream ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Fires proxy error:', err.message);
        res.status(502).json({ error: 'Failed to fetch fire data', detail: err.message });
    }
});

// RainViewer weather
app.get('/api/weather/rainviewer', async (req, res) => {
    try {
        const url = 'https://api.rainviewer.com/public/weather-maps.json';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Upstream ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Weather proxy error:', err.message);
        res.status(502).json({ error: 'Failed to fetch weather data', detail: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSINT Hub running at http://localhost:${PORT}`);
});

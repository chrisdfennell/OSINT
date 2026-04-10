const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Proxy Routes ──
// These proxy external APIs to avoid browser CORS restrictions

// ADS-B flight data (adsb.lol)
app.get('/api/flights/:lat/:lon/:radius', async (req, res) => {
    try {
        const { lat, lon, radius } = req.params;
        const url = `https://api.adsb.lol/v2/point/${lat}/${lon}/${radius}`;
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

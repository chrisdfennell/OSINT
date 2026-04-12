import { initMap, setBaseMap } from './map.js';
import { initFlightLayer, setEnabled as setFlightsEnabled } from './layers/flights.js';
import { initEarthquakeLayer, setEnabled as setQuakesEnabled } from './layers/earthquakes.js';
import { initWeatherLayers, setRadarEnabled, setRainViewerEnabled, setNexradEnabled, setCloudsEnabled, setWindEnabled, setTempEnabled, setOWMKey } from './layers/weather.js';
import { initFireLayer, setEnabled as setFiresEnabled } from './layers/fires.js';
import { initVesselLayer, setEnabled as setVesselsEnabled } from './layers/vessels.js';
import { initGdeltLayer, setEnabled as setGdeltEnabled } from './layers/gdelt.js';
import { initLightningLayer, setEnabled as setLightningEnabled } from './layers/lightning.js';
import { initVolcanoLayer, setEnabled as setVolcanoesEnabled } from './layers/volcanoes.js';
import { initCycloneLayer, setEnabled as setCyclonesEnabled } from './layers/cyclones.js';
import { initISSLayer, setEnabled as setISSEnabled } from './layers/iss.js';
import { initCablesLayer, setEnabled as setCablesEnabled } from './layers/cables.js';
import { initAirQualityLayer, setEnabled as setAirQualityEnabled } from './layers/airquality.js';
import { initAuroraLayer, setEnabled as setAuroraEnabled } from './layers/aurora.js';
import { initSatellitesLayer, setEnabled as setSatellitesEnabled } from './layers/satellites.js';
import { initPowerPlantsLayer, setEnabled as setPowerPlantsEnabled } from './layers/powerplants.js';
import { initWebcamsLayer, setEnabled as setWebcamsEnabled } from './layers/webcams.js';
import { initMeasureTool } from './measure.js';
import { initHotSpots } from './hotspots.js';
import { initSearch } from './search.js';
import { initStateSync } from './state.js';
import { initSidebarGroups } from './sidebar.js';
import { showToast } from './toast.js';
import { initTicker } from './ticker.js';
import { tools } from './data/tools.js';
import { categories } from './data/categories.js';

// ── News channels (YouTube live embeds) ──
// Uses youtube.com/embed/live_stream?channel=<id> — only works while the
// channel has a single active livestream. If an embed shows "unavailable",
// the channel likely paused its 24/7 stream; swap the entry out.
const newsChannels = [
    { id: 'al-jazeera',  name: 'Al Jazeera English', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', url: 'https://www.youtube.com/@AlJazeeraEnglish/live' },
    { id: 'france24',    name: 'France 24',          channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', url: 'https://www.youtube.com/@FRANCE24English/live' },
    { id: 'dw-news',     name: 'DW News',            channel: 'UCknLrEdhRCp1aegoMqRaCZg', url: 'https://www.youtube.com/@DWNews/live' },
    { id: 'abc-news',    name: 'ABC News',           channel: 'UCBi2mrWuNuyYy4gbM6fU18Q', url: 'https://www.youtube.com/@ABCNews/live' },
    { id: 'nbc-news',    name: 'NBC News',           channel: 'UCeY0bbntWzzVIaj2z3QigXg', url: 'https://www.youtube.com/@NBCNews/live' },
    { id: 'cbs-news',    name: 'CBS News',           channel: 'UC8p1vwvWtl6T73JiExfWs1g', url: 'https://www.youtube.com/@CBSNews/live' },
    { id: 'livenow-fox', name: 'LiveNOW from FOX',   channel: 'UCWQO6RCa6qJi8-rJZ9wJhcg', url: 'https://www.youtube.com/@LiveNOWFOX/live' },
    { id: 'bloomberg',   name: 'Bloomberg TV',       channel: 'UCIALMKvObZNtJ6AmdCLP7Lg', url: 'https://www.youtube.com/@markets/live' },
    { id: 'wion',        name: 'WION',               channel: 'UC_gUM8rL-Lrg6O3adPW9K1g', url: 'https://www.youtube.com/@WION/live' },
    { id: 'euronews-en', name: 'Euronews English',   channel: 'UCSrZ3UV4jOidv8ppoVuvW9Q', url: 'https://www.youtube.com/@euronewsen/live' },
    { id: 'africanews',  name: 'Africanews',         channel: 'UCz40b_PNY9NXU_sTHD5dQTA', url: 'https://www.youtube.com/@africanews/live' },
    { id: 'trt-world',   name: 'TRT World',          channel: 'UC7fWeaHhqgM4Ry-RMpM2YYw', url: 'https://www.youtube.com/@trtworld/live' },
];

let currentTab = 'map';

function init() {
    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Init map
    const map = initMap();

    // Init data layers
    initFlightLayer(map);
    initEarthquakeLayer(map);
    initWeatherLayers(map);
    initFireLayer(map);
    initVesselLayer(map);
    initGdeltLayer(map);
    initLightningLayer(map);
    initVolcanoLayer(map);
    initCycloneLayer(map);
    initISSLayer(map);
    initCablesLayer(map);
    initAirQualityLayer(map);
    initAuroraLayer(map);
    initSatellitesLayer(map);
    initPowerPlantsLayer(map);
    initWebcamsLayer(map);
    initMeasureTool(map);
    initSearch(map);

    // Wire up layer toggles
    setupLayerToggles();

    // Wire up base map switcher
    setupBaseMapSwitcher();

    // Wire up tab navigation
    setupTabs();

    // Wire up sidebar toggle (mobile)
    setupSidebarToggle();

    // Wire up OWM API key
    setupOWMKey();

    // Sidebar group collapse/expand
    initSidebarGroups();

    // Hot Spots panel (dynamic webcam ranking by YouTube viewers)
    initHotSpots();

    // Start news ticker
    initTicker();

    // URL hash state sync (must run after toggles and basemap switcher are wired).
    initStateSync(map);

    // Render news & tools panels
    renderNewsSidebar();
    renderNewsGrid();
    renderToolsSidebar();
    renderToolsGrid();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '1') switchTab('map');
        if (e.key === '2') switchTab('news');
        if (e.key === '3') switchTab('tools');
    });
}

// ── Clock ──
function updateClock() {
    const now = new Date();
    document.getElementById('clock-utc').textContent = now.toISOString().slice(11, 19);
    document.getElementById('clock-local').textContent = now.toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

// ── Tab Navigation ──
function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === `view-${tabName}`);
    });

    // Update sidebar panels
    document.querySelectorAll('.sidebar-panel').forEach(p => {
        p.classList.toggle('hidden', p.id !== `panel-${tabName}`);
    });

    // Update status
    const statusText = { map: 'Map View', news: 'Live News', tools: 'Tools Directory' };
    document.getElementById('status-text').textContent = statusText[tabName] || tabName;

    // Invalidate map size when switching back to map
    if (tabName === 'map') {
        setTimeout(() => {
            const mapInstance = window._osintMap;
            if (mapInstance) mapInstance.invalidateSize();
        }, 100);
    }
}

// ── Layer Toggles ──
function setupLayerToggles() {
    document.getElementById('layer-flights').addEventListener('change', (e) => {
        setFlightsEnabled(e.target.checked);
    });

    document.getElementById('layer-earthquakes').addEventListener('change', (e) => {
        setQuakesEnabled(e.target.checked);
    });

    document.getElementById('layer-fires').addEventListener('change', (e) => {
        setFiresEnabled(e.target.checked);
    });

    document.getElementById('layer-vessels').addEventListener('change', (e) => {
        setVesselsEnabled(e.target.checked);
    });

    document.getElementById('layer-weather').addEventListener('change', (e) => {
        setRadarEnabled(e.target.checked);
    });

    document.getElementById('layer-nexrad').addEventListener('change', (e) => {
        setNexradEnabled(e.target.checked);
    });

    document.getElementById('layer-rainviewer').addEventListener('change', (e) => {
        setRainViewerEnabled(e.target.checked);
    });

    document.getElementById('layer-gdelt').addEventListener('change', (e) => {
        setGdeltEnabled(e.target.checked);
    });

    document.getElementById('layer-lightning').addEventListener('change', (e) => {
        setLightningEnabled(e.target.checked);
    });

    document.getElementById('layer-volcanoes').addEventListener('change', (e) => {
        setVolcanoesEnabled(e.target.checked);
    });

    document.getElementById('layer-cyclones').addEventListener('change', (e) => {
        setCyclonesEnabled(e.target.checked);
    });

    document.getElementById('layer-iss').addEventListener('change', (e) => {
        setISSEnabled(e.target.checked);
    });

    document.getElementById('layer-cables').addEventListener('change', (e) => {
        setCablesEnabled(e.target.checked);
    });

    document.getElementById('layer-airquality').addEventListener('change', (e) => {
        setAirQualityEnabled(e.target.checked);
    });

    document.getElementById('layer-aurora').addEventListener('change', (e) => {
        setAuroraEnabled(e.target.checked);
    });

    document.getElementById('layer-satellites').addEventListener('change', (e) => {
        setSatellitesEnabled(e.target.checked);
    });

    document.getElementById('layer-powerplants').addEventListener('change', (e) => {
        setPowerPlantsEnabled(e.target.checked);
    });

    document.getElementById('layer-webcams').addEventListener('change', (e) => {
        setWebcamsEnabled(e.target.checked);
    });

    document.getElementById('layer-clouds').addEventListener('change', (e) => {
        setCloudsEnabled(e.target.checked);
    });

    document.getElementById('layer-wind').addEventListener('change', (e) => {
        setWindEnabled(e.target.checked);
        document.getElementById('legend-wind').classList.toggle('visible', e.target.checked);
    });

    document.getElementById('layer-temp').addEventListener('change', (e) => {
        setTempEnabled(e.target.checked);
        document.getElementById('legend-temp').classList.toggle('visible', e.target.checked);
    });
}

// ── Base Map Switcher ──
function setupBaseMapSwitcher() {
    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setBaseMap(e.target.value);
        });
    });
}

// ── OWM API Key (auto-loaded from server .env) ──
async function setupOWMKey() {
    try {
        const res = await fetch('/api/config/owm');
        if (res.ok) {
            const data = await res.json();
            if (data.key) setOWMKey(data.key);
        }
    } catch { /* server not available */ }
}

// ── Sidebar Toggle (Mobile) ──
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('sidebar-toggle');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    });
}

// ── News Rendering ──
function renderNewsSidebar() {
    const list = document.getElementById('news-channel-list');
    list.innerHTML = newsChannels.map(ch => `
        <div class="news-channel-item" data-channel="${ch.id}">
            <span class="news-channel-dot"></span>
            <span>${ch.name}</span>
        </div>
    `).join('');
}

function renderNewsGrid() {
    const grid = document.getElementById('news-grid');
    grid.innerHTML = newsChannels.map(ch => `
        <div class="news-card" id="news-${ch.id}">
            <div class="news-card-header">
                <div class="news-card-title">
                    <span class="news-live-badge">LIVE</span>
                    ${ch.name}
                </div>
                <a class="news-card-link" href="${ch.url}" target="_blank" rel="noopener">Open on YouTube</a>
            </div>
            <div class="news-card-body">
                <iframe
                    src="https://www.youtube.com/embed/live_stream?channel=${ch.channel}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                ></iframe>
            </div>
        </div>
    `).join('');
}

// ── Tools Rendering ──
function renderToolsSidebar() {
    const list = document.getElementById('tools-list');
    const grouped = {};

    for (const tool of tools) {
        if (!grouped[tool.category]) grouped[tool.category] = [];
        grouped[tool.category].push(tool);
    }

    let html = '';
    for (const cat of categories) {
        const catTools = grouped[cat.id];
        if (!catTools || catTools.length === 0) continue;

        html += `<div class="tool-list-category">${cat.name}</div>`;
        for (const tool of catTools) {
            html += `
                <a class="tool-list-item" href="${tool.url}" target="_blank" rel="noopener">
                    <span class="tool-list-dot" style="background:${cat.color}"></span>
                    <span>${tool.name}</span>
                </a>
            `;
        }
    }

    list.innerHTML = html;

    // Search filter
    document.getElementById('tool-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = list.querySelectorAll('.tool-list-item');
        const headers = list.querySelectorAll('.tool-list-category');

        if (!query) {
            items.forEach(i => i.style.display = '');
            headers.forEach(h => h.style.display = '');
            return;
        }

        headers.forEach(h => h.style.display = 'none');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

function renderToolsGrid() {
    const grid = document.getElementById('tools-grid');
    const grouped = {};

    for (const tool of tools) {
        if (!grouped[tool.category]) grouped[tool.category] = [];
        grouped[tool.category].push(tool);
    }

    let html = '';
    for (const cat of categories) {
        const catTools = grouped[cat.id];
        if (!catTools || catTools.length === 0) continue;

        html += `<div class="tools-category-header" style="border-color:${cat.color}40">
            <span style="color:${cat.color}">${cat.name}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;font-weight:400">${catTools.length} tools</span>
        </div>`;

        for (const tool of catTools) {
            html += `
                <div class="tool-card">
                    <div class="tool-card-name">${tool.name}</div>
                    <div class="tool-card-desc">${tool.description}</div>
                    <a class="tool-card-link" href="${tool.url}" target="_blank" rel="noopener">
                        Open
                        <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <div class="tool-card-tags">
                        ${tool.tags.map(t => `<span class="tool-tag">${t}</span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    grid.innerHTML = html;
}

// Boot
document.addEventListener('DOMContentLoaded', init);

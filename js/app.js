import { initMap, setBaseMap } from './map.js';
import { initFlightLayer, setEnabled as setFlightsEnabled } from './layers/flights.js';
import { initEarthquakeLayer, setEnabled as setQuakesEnabled } from './layers/earthquakes.js';
import { initWeatherLayers, setRadarEnabled, setCloudsEnabled, setWindEnabled, setTempEnabled } from './layers/weather.js';
import { initFireLayer, setEnabled as setFiresEnabled } from './layers/fires.js';
import { tools } from './data/tools.js';
import { categories } from './data/categories.js';

// ── News channels (YouTube live embeds) ──
const newsChannels = [
    { id: 'sky-news', name: 'Sky News', channel: 'UCoMdktPbSTixAyNGwb-UYkQ', url: 'https://www.youtube.com/@SkyNews/live' },
    { id: 'al-jazeera', name: 'Al Jazeera English', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', url: 'https://www.youtube.com/@AlJazeeraEnglish/live' },
    { id: 'france24', name: 'France 24', channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', url: 'https://www.youtube.com/@FRANCE24English/live' },
    { id: 'dw-news', name: 'DW News', channel: 'UCknLrEdhRCp1aegoMqRaCZg', url: 'https://www.youtube.com/@DWNews/live' },
    { id: 'abc-news', name: 'ABC News', channel: 'UCBi2mrWuNuyYy4gbM6fU18Q', url: 'https://www.youtube.com/@ABCNews/live' },
    { id: 'nbc-news', name: 'NBC News', channel: 'UCeY0bbntWzzVIaj2z3QigXg', url: 'https://www.youtube.com/@NBCNews/live' },
    { id: 'euronews', name: 'Euronews', channel: 'UCW2QcKZiU8aUGg4yxCIditg', url: 'https://www.youtube.com/@euronews/live' },
    { id: 'nhk-world', name: 'NHK World', channel: 'UCi2KNss4Yx73V0JVoaBNDOA', url: 'https://www.youtube.com/@NHKWORLDJAPAN/live' },
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

    // Wire up layer toggles
    setupLayerToggles();

    // Wire up base map switcher
    setupBaseMapSwitcher();

    // Wire up tab navigation
    setupTabs();

    // Wire up sidebar toggle (mobile)
    setupSidebarToggle();

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

    document.getElementById('layer-weather').addEventListener('change', (e) => {
        setRadarEnabled(e.target.checked);
    });

    document.getElementById('layer-clouds').addEventListener('change', (e) => {
        setCloudsEnabled(e.target.checked);
    });

    document.getElementById('layer-wind').addEventListener('change', (e) => {
        setWindEnabled(e.target.checked);
    });

    document.getElementById('layer-temp').addEventListener('change', (e) => {
        setTempEnabled(e.target.checked);
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

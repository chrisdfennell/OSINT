import { categories } from './data/categories.js';
import { tools } from './data/tools.js';
import { isFavorite, toggleFavorite } from './favorites.js';
import { categoryIcons, uiIcons } from './icons.js';
import { updateFavoriteBadge } from './sidebar.js';

const mainContent = () => document.getElementById('main-content');
const activeIframes = new Map(); // track loaded iframes for cleanup

export function renderRoute(route, searchResults) {
    // Clean up old iframes
    unloadIframes();

    if (searchResults) {
        renderSearchResults(searchResults);
    } else if (route === 'dashboard') {
        renderDashboard();
    } else if (route === 'favorites') {
        renderFavorites();
    } else {
        renderCategory(route);
    }

    updateStatusBar(route);
}

function renderDashboard() {
    const el = mainContent();
    let html = `
        <div class="category-header">
            <h1 class="category-title">
                <span class="category-title-icon">${categoryIcons.dashboard}</span>
                Dashboard
            </h1>
            <p class="category-description">All OSINT categories at a glance. Click a category to explore its tools.</p>
        </div>
        <div class="dashboard-grid">
    `;

    categories.forEach(cat => {
        const count = tools.filter(t => t.category === cat.id).length;
        const icon = categoryIcons[cat.id] || categoryIcons.default;
        html += `
            <div class="dashboard-category-card" data-route="${cat.id}" onclick="location.hash='${cat.id}'">
                <div class="dashboard-category-icon" style="background: ${cat.color}20; color: ${cat.color}">
                    ${icon}
                </div>
                <div class="dashboard-category-name">${cat.name}</div>
                <div class="dashboard-category-desc">${cat.description}</div>
                <div class="dashboard-category-count">${count} tool${count !== 1 ? 's' : ''}</div>
            </div>
        `;
    });

    html += '</div>';
    el.innerHTML = html;
}

function renderCategory(categoryId) {
    const el = mainContent();
    const category = categories.find(c => c.id === categoryId);

    if (!category) {
        el.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">${uiIcons.search}</div>
                <div class="no-results-text">Category not found</div>
                <div class="no-results-hint">Try selecting a category from the sidebar</div>
            </div>
        `;
        return;
    }

    const categoryTools = tools.filter(t => t.category === categoryId);
    const icon = categoryIcons[categoryId] || categoryIcons.default;

    let html = `
        <div class="category-header">
            <h1 class="category-title">
                <span class="category-title-icon" style="color: ${category.color}">${icon}</span>
                ${category.name}
            </h1>
            <p class="category-description">${category.description}</p>
            <p class="category-tool-count">${categoryTools.length} tool${categoryTools.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="tool-grid">
    `;

    categoryTools.forEach(tool => {
        html += renderToolCard(tool);
    });

    html += '</div>';
    el.innerHTML = html;
    attachCardListeners();
}

function renderFavorites() {
    const el = mainContent();
    const favIds = JSON.parse(localStorage.getItem('osint-dashboard-favorites') || '[]');
    const favTools = tools.filter(t => favIds.includes(t.id));

    let html = `
        <div class="category-header">
            <h1 class="category-title">
                <span class="category-title-icon" style="color: var(--warning)">${categoryIcons.star}</span>
                Favorites
            </h1>
            <p class="category-description">Your saved tools for quick access</p>
            <p class="category-tool-count">${favTools.length} tool${favTools.length !== 1 ? 's' : ''}</p>
        </div>
    `;

    if (favTools.length === 0) {
        html += `
            <div class="no-results">
                <div class="no-results-icon" style="color: var(--warning)">${uiIcons.star}</div>
                <div class="no-results-text">No favorites yet</div>
                <div class="no-results-hint">Click the star icon on any tool to add it here</div>
            </div>
        `;
    } else {
        html += '<div class="tool-grid">';
        favTools.forEach(tool => {
            html += renderToolCard(tool);
        });
        html += '</div>';
    }

    el.innerHTML = html;
    attachCardListeners();
}

function renderSearchResults(results) {
    const el = mainContent();

    let html = `
        <div class="search-results-header">
            Found <strong>${results.length}</strong> tool${results.length !== 1 ? 's' : ''}
        </div>
    `;

    if (results.length === 0) {
        html += `
            <div class="no-results">
                <div class="no-results-icon">${uiIcons.search}</div>
                <div class="no-results-text">No tools found</div>
                <div class="no-results-hint">Try different keywords or browse categories</div>
            </div>
        `;
    } else {
        html += '<div class="tool-grid">';
        results.forEach(tool => {
            html += renderToolCard(tool, true);
        });
        html += '</div>';
    }

    el.innerHTML = html;
    attachCardListeners();
}

function renderToolCard(tool, showCategory = false) {
    const fav = isFavorite(tool.id);
    const isEmbed = tool.type === 'iframe';
    const category = showCategory ? categories.find(c => c.id === tool.category) : null;

    let html = `
        <div class="tool-card" data-tool-id="${tool.id}" id="card-${tool.id}">
            <div class="tool-card-header">
                <div class="tool-card-info">
                    <div class="tool-card-name">
                        ${tool.name}
                        <span class="tool-badge ${isEmbed ? 'embed' : 'external'}">
                            ${isEmbed ? 'EMBED' : 'LINK'}
                        </span>
                    </div>
                    <div class="tool-card-description">${tool.description}</div>
                    ${category ? `<div class="tool-card-description" style="color: ${category.color}; margin-top: 2px;">${category.name}</div>` : ''}
                </div>
                <div class="tool-card-actions">
                    <button class="tool-btn fav-btn ${fav ? 'favorited' : ''}" data-tool-id="${tool.id}" title="${fav ? 'Remove from favorites' : 'Add to favorites'}">
                        ${fav ? uiIcons.starFilled : uiIcons.star}
                    </button>
                    ${isEmbed ? `
                        <button class="tool-btn expand-btn" data-tool-id="${tool.id}" title="Expand">
                            ${uiIcons.expand}
                        </button>
                    ` : ''}
                    <a class="tool-btn" href="${tool.url}" target="_blank" rel="noopener noreferrer" title="Open in new tab">
                        ${uiIcons.externalLink}
                    </a>
                </div>
            </div>
    `;

    if (isEmbed) {
        html += `
            <div class="tool-card-body">
                <div class="tool-iframe-placeholder" data-tool-id="${tool.id}" data-embed-url="${tool.embedUrl}">
                    <div class="tool-iframe-placeholder-icon">${uiIcons.play}</div>
                    <div class="tool-iframe-placeholder-text">Click to load ${tool.name}</div>
                </div>
            </div>
        `;
    } else {
        html += `
            <a class="tool-card-link" href="${tool.url}" target="_blank" rel="noopener noreferrer">
                Open ${tool.name}
                ${uiIcons.externalLink}
            </a>
        `;
    }

    // Tags
    html += '<div class="tool-card-tags">';
    tool.tags.forEach(tag => {
        html += `<span class="tool-tag">${tag}</span>`;
    });
    html += '</div>';

    html += '</div>';
    return html;
}

function attachCardListeners() {
    // Favorite buttons
    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolId = btn.dataset.toolId;
            const nowFav = toggleFavorite(toolId);
            btn.classList.toggle('favorited', nowFav);
            btn.innerHTML = nowFav ? uiIcons.starFilled : uiIcons.star;
            btn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
            updateFavoriteBadge();
            updateStatusBar();
        });
    });

    // Iframe placeholders - lazy load
    document.querySelectorAll('.tool-iframe-placeholder').forEach(placeholder => {
        placeholder.addEventListener('click', () => {
            const toolId = placeholder.dataset.toolId;
            const embedUrl = placeholder.dataset.embedUrl;
            loadIframe(toolId, embedUrl, placeholder);
        });
    });

    // Expand buttons
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolId = btn.dataset.toolId;
            const card = document.getElementById(`card-${toolId}`);
            const isExpanded = card.classList.toggle('expanded');
            btn.innerHTML = isExpanded ? uiIcons.collapse : uiIcons.expand;
            btn.title = isExpanded ? 'Collapse' : 'Expand';
        });
    });
}

function loadIframe(toolId, embedUrl, placeholder) {
    const body = placeholder.parentElement;
    body.innerHTML = `
        <div class="tool-iframe-container" data-tool-id="${toolId}">
            <div class="tool-iframe-loading">
                <div>
                    <div class="spinner"></div>
                    <div>Loading...</div>
                </div>
            </div>
            <iframe
                src="${embedUrl}"
                allow="fullscreen; autoplay; encrypted-media"
                allowfullscreen
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                loading="lazy"
                referrerpolicy="no-referrer"
                onload="this.previousElementSibling.style.display='none'"
            ></iframe>
        </div>
    `;
    activeIframes.set(toolId, body.querySelector('iframe'));
    updateActiveFeedsCount();
}

function unloadIframes() {
    activeIframes.forEach((iframe) => {
        iframe.src = 'about:blank';
    });
    activeIframes.clear();
    updateActiveFeedsCount();
}

function updateActiveFeedsCount() {
    const el = document.getElementById('status-active-feeds');
    if (el) {
        el.textContent = `${activeIframes.size} active feed${activeIframes.size !== 1 ? 's' : ''}`;
    }
}

function updateStatusBar(route) {
    const categoryEl = document.getElementById('status-category');
    const toolCountEl = document.getElementById('status-tool-count');
    const favEl = document.getElementById('status-favorites');

    if (route) {
        if (route === 'dashboard') {
            categoryEl.textContent = 'Dashboard';
            toolCountEl.textContent = `${tools.length} tools available`;
        } else if (route === 'favorites') {
            categoryEl.textContent = 'Favorites';
        } else {
            const cat = categories.find(c => c.id === route);
            categoryEl.textContent = cat ? cat.name : route;
            const count = tools.filter(t => t.category === route).length;
            toolCountEl.textContent = `${count} tool${count !== 1 ? 's' : ''} in category`;
        }
    }

    const favCount = JSON.parse(localStorage.getItem('osint-dashboard-favorites') || '[]').length;
    favEl.textContent = `${favCount} favorite${favCount !== 1 ? 's' : ''}`;
    updateActiveFeedsCount();
}

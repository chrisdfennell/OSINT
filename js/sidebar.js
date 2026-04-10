import { categories } from './data/categories.js';
import { tools } from './data/tools.js';
import { navigate, getCurrentRoute } from './router.js';
import { getFavorites } from './favorites.js';
import { categoryIcons } from './icons.js';

let sidebarEl;
let overlayEl;
let toggleBtn;

export function initSidebar() {
    sidebarEl = document.getElementById('sidebar');
    overlayEl = document.getElementById('sidebar-overlay');
    toggleBtn = document.getElementById('sidebar-toggle');

    toggleBtn.addEventListener('click', toggleSidebar);
    overlayEl.addEventListener('click', closeSidebar);

    renderSidebar();
}

export function updateActiveItem(route) {
    const items = sidebarEl.querySelectorAll('.sidebar-item');
    items.forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
    });

    // Close mobile sidebar on navigation
    closeSidebar();
}

function toggleSidebar() {
    sidebarEl.classList.toggle('open');
    overlayEl.classList.toggle('visible');
}

function closeSidebar() {
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('visible');
}

function getToolCount(categoryId) {
    return tools.filter(t => t.category === categoryId).length;
}

function renderSidebar() {
    const container = document.getElementById('sidebar-content');
    const favCount = getFavorites().length;

    let html = '';

    // Dashboard item
    html += `
        <div class="sidebar-section">
            <a class="sidebar-item" data-route="dashboard" href="#dashboard">
                <span class="sidebar-item-icon">${categoryIcons.dashboard}</span>
                <span class="sidebar-item-text">Dashboard</span>
            </a>
            <a class="sidebar-item favorites-item" data-route="favorites" href="#favorites">
                <span class="sidebar-item-icon">${categoryIcons.star}</span>
                <span class="sidebar-item-text">Favorites</span>
                <span class="sidebar-item-badge" id="fav-count-badge">${favCount}</span>
            </a>
        </div>
        <div class="sidebar-divider"></div>
        <div class="sidebar-section">
            <div class="sidebar-section-label">Categories</div>
    `;

    // Category items
    categories.forEach(cat => {
        const count = getToolCount(cat.id);
        const icon = categoryIcons[cat.id] || categoryIcons.default;
        html += `
            <a class="sidebar-item" data-route="${cat.id}" href="#${cat.id}">
                <span class="sidebar-item-icon">${icon}</span>
                <span class="sidebar-item-text">${cat.name}</span>
                <span class="sidebar-item-badge">${count}</span>
            </a>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Set active state
    updateActiveItem(getCurrentRoute());
}

export function updateFavoriteBadge() {
    const badge = document.getElementById('fav-count-badge');
    if (badge) {
        badge.textContent = getFavorites().length;
    }
}

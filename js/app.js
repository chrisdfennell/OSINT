import { initRouter, onRouteChange, getCurrentRoute } from './router.js';
import { initSidebar, updateActiveItem } from './sidebar.js';
import { initSearch, searchTools, focusSearch, clearSearch } from './search.js';
import { renderRoute } from './panel-renderer.js';

let currentSearchResults = null;

function init() {
    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Init sidebar
    initSidebar();

    // Init search
    initSearch((query) => {
        if (query) {
            currentSearchResults = searchTools(query);
            renderRoute(getCurrentRoute(), currentSearchResults);
        } else {
            currentSearchResults = null;
            renderRoute(getCurrentRoute());
        }
    });

    // Init router
    onRouteChange((route) => {
        updateActiveItem(route);
        // Clear search when navigating
        if (currentSearchResults) {
            clearSearch();
            currentSearchResults = null;
        }
        renderRoute(route);
    });

    initRouter();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // "/" to focus search (unless already in input)
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            focusSearch();
        }

        // Escape to close expanded cards
        if (e.key === 'Escape') {
            document.querySelectorAll('.tool-card.expanded').forEach(card => {
                card.classList.remove('expanded');
            });
        }
    });
}

function updateClock() {
    const now = new Date();

    const utc = now.toISOString().slice(11, 19);
    document.getElementById('clock-utc').textContent = utc;

    const local = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    document.getElementById('clock-local').textContent = local;
}

// Boot
document.addEventListener('DOMContentLoaded', init);

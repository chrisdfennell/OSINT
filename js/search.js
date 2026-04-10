import { tools } from './data/tools.js';

let searchInput;
let onSearchCallback;
let debounceTimer;

export function initSearch(callback) {
    onSearchCallback = callback;
    searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput.value.trim();
            onSearchCallback(query);
        }, 250);
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchInput.blur();
            onSearchCallback('');
        }
    });
}

export function focusSearch() {
    searchInput.focus();
    searchInput.select();
}

export function clearSearch() {
    searchInput.value = '';
}

export function searchTools(query) {
    if (!query) return null; // null means "no search active"

    const lower = query.toLowerCase();
    const terms = lower.split(/\s+/).filter(Boolean);

    const scored = tools.map(tool => {
        let score = 0;
        const name = tool.name.toLowerCase();
        const desc = tool.description.toLowerCase();
        const tags = tool.tags.join(' ').toLowerCase();

        for (const term of terms) {
            // Exact name match
            if (name === term) score += 100;
            // Name starts with term
            else if (name.startsWith(term)) score += 50;
            // Name contains term
            else if (name.includes(term)) score += 30;
            // Tag exact match
            if (tool.tags.some(t => t === term)) score += 25;
            // Tag contains term
            else if (tags.includes(term)) score += 15;
            // Description contains term
            if (desc.includes(term)) score += 10;
        }

        return { tool, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.tool);
}

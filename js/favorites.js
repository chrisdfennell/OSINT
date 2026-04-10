const STORAGE_KEY = 'osint-dashboard-favorites';

export function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

export function isFavorite(toolId) {
    return getFavorites().includes(toolId);
}

export function toggleFavorite(toolId) {
    const favs = getFavorites();
    const index = favs.indexOf(toolId);
    if (index === -1) {
        favs.push(toolId);
    } else {
        favs.splice(index, 1);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    return index === -1; // returns true if now favorited
}

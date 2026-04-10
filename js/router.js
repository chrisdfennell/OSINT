const listeners = [];

export function onRouteChange(callback) {
    listeners.push(callback);
}

export function navigate(categoryId) {
    location.hash = categoryId;
}

export function getCurrentRoute() {
    return location.hash.slice(1) || 'dashboard';
}

export function initRouter() {
    const handler = () => {
        const route = getCurrentRoute();
        listeners.forEach(cb => cb(route));
    };

    window.addEventListener('hashchange', handler);

    // Fire initial route
    handler();
}

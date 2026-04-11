// Toast notification system for error/info feedback

const TOAST_DURATION = 5000;
const MAX_TOASTS = 4;

let container;

function ensureContainer() {
    if (container) return;
    container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
}

export function showToast(message, type = 'error') {
    ensureContainer();

    // Limit visible toasts
    while (container.children.length >= MAX_TOASTS) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.error}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

    container.appendChild(toast);
    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('toast-visible');

    setTimeout(() => dismissToast(toast), TOAST_DURATION);
}

function dismissToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback removal if transition doesn't fire
    setTimeout(() => toast.remove(), 300);
}

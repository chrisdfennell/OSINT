// Collapsible sidebar sections. Each .sidebar-group remembers its
// collapsed/expanded state in localStorage under 'sidebar-collapsed'.

const STORAGE_KEY = 'sidebar-collapsed';

function readState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function writeState(set) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch { /* private mode etc. — best effort */ }
}

export function initSidebarGroups() {
    const collapsed = readState();
    const groups = document.querySelectorAll('.sidebar-group[data-group]');

    for (const group of groups) {
        const name = group.dataset.group;
        if (collapsed.has(name)) group.classList.add('collapsed');

        const header = group.querySelector('.sidebar-group-header');
        if (!header) continue;
        header.addEventListener('click', () => {
            group.classList.toggle('collapsed');
            if (group.classList.contains('collapsed')) collapsed.add(name);
            else collapsed.delete(name);
            writeState(collapsed);
        });
    }
}

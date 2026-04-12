// OpenSanctions lookup. Used by the vessel layer (and can be reused for any
// named entity) to check whether a ship/company/person appears on a sanctions
// list. The server proxy caches per-query for 1h to stay polite with the free
// public OpenSanctions API.

const inflight = new Map();
const resultCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

export async function checkSanctions(query) {
    const key = (query || '').trim().toLowerCase();
    if (!key) return { results: [] };

    const cached = resultCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    if (inflight.has(key)) return inflight.get(key);

    const p = (async () => {
        try {
            const r = await fetch(`/api/sanctions/search?q=${encodeURIComponent(query)}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            resultCache.set(key, { data, ts: Date.now() });
            return data;
        } catch (err) {
            return { results: [], error: err.message };
        } finally {
            inflight.delete(key);
        }
    })();

    inflight.set(key, p);
    return p;
}

// Render helper: returns an HTML snippet for embedding in a popup.
export function renderSanctionsResult(data) {
    if (data.error) {
        return `<div class="sanctions-row sanctions-err">Lookup failed: ${data.error}</div>`;
    }
    if (!data.results || data.results.length === 0) {
        return `<div class="sanctions-row sanctions-clean">✓ No OpenSanctions matches.</div>`;
    }
    // Show top 3 — the client only asks for 5, and UI space is tight.
    const items = data.results.slice(0, 3).map(m => {
        const topics = (m.topics || []).slice(0, 3).join(', ');
        const datasets = (m.datasets || []).slice(0, 3).join(', ');
        const countries = (m.countries || []).slice(0, 3).join(', ').toUpperCase();
        return `
            <div class="sanctions-hit">
                <div class="sanctions-hit-name">
                    <a href="https://www.opensanctions.org/entities/${m.id}/" target="_blank" rel="noopener">${m.caption}</a>
                    <span class="sanctions-hit-schema">${m.schema || ''}</span>
                </div>
                <div class="sanctions-hit-meta">
                    ${countries ? `<span>${countries}</span>` : ''}
                    ${topics ? `<span>${topics}</span>` : ''}
                    ${datasets ? `<span title="Datasets">${datasets}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    return `
        <div class="sanctions-row sanctions-hit-header">⚠ ${data.results.length} OpenSanctions hit${data.results.length === 1 ? '' : 's'}</div>
        ${items}
    `;
}

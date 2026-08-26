/**
 * Pingo - Exact Search Manager (MiniSearch)
 */

export class SearchManager {
    constructor() {
        this.miniSearch = null;
        this.isReady = false;
    }

    init() {
        if (typeof MiniSearch === 'undefined') {
            console.error('[SearchManager] MiniSearch library not loaded!');
            return false;
        }

        this.miniSearch = new MiniSearch({
            fields: ['name', 'content'], // fields to index for full-text search
            storeFields: ['id', 'name', 'type', 'visibility'], // fields to return with search results
            searchOptions: {
                boost: { name: 2 },
                fuzzy: 0.2 // allow slight typos
            }
        });

        this.isReady = true;
        return true;
    }

    async indexData(items, readFileFn) {
        if (!this.isReady && !this.init()) return;

        this.miniSearch.removeAll(); // Clear existing index
        const docs = [];

        for (const item of items) {
            let content = '';
            if (item.type === 'note' || item.type === 'link') {
                try {
                    content = await readFileFn(item.id) || '';
                } catch (e) {
                    console.warn('[SearchManager] Could not read file content for', item.id);
                }
            }

            docs.push({
                id: item.id,
                name: item.name,
                type: item.type,
                content: content,
                visibility: item.visibility || 'private'
            });
        }

        this.miniSearch.addAll(docs);
        console.log(`[SearchManager] Indexed ${docs.length} items for exact search.`);
    }

    searchExact(query, requirePublic = false) {
        if (!this.isReady) return [];

        let results = this.miniSearch.search(query);

        if (requirePublic) {
            results = results.filter(r => r.visibility === 'public');
        }

        return results.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            score: r.score,
            similarity: r.score // Normalizamos para UI
        }));
    }
}

export const searchManager = new SearchManager();

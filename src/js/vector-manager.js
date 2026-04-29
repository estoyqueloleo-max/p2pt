/**
 * Pingo - Vector & Semantic Manager
 * Orchestrates Transformers.js worker and IndexedDB storage
 */

const DB_NAME = 'pingo-vectors';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';

class VectorManager {
    constructor() {
        this.worker = null;
        this.db = null;
        this.isReady = false;
        this.pendingRequests = new Map();
        this._initPromise = this.init();
    }

    async init() {
        if (this.db) return;

        // 1. Initialize IndexedDB
        this.db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });

        // 2. Initialize Worker
        this.worker = new Worker(new URL('./vector-worker.js', import.meta.url), { type: 'module' });
        
        this.worker.onmessage = (event) => {
            const { type, data, id } = event.data;
            
            if (type === 'ready') {
                this.isReady = true;
                console.log('[VectorManager] Worker is ready.');
            }
            
            if (this.pendingRequests.has(id)) {
                const { resolve, reject } = this.pendingRequests.get(id);
                if (type === 'embed-result') {
                    resolve(data);
                    this.pendingRequests.delete(id);
                } else if (type === 'error') {
                    reject(new Error(data));
                    this.pendingRequests.delete(id);
                }
            }

            // Global events like progress
            if (type === 'progress') {
                window.dispatchEvent(new CustomEvent('vector-progress', { detail: data }));
            }
        };

        this.worker.postMessage({ type: 'init' });
    }

    /**
     * Generate embedding for a text string
     */
    async getEmbedding(text) {
        await this._initPromise;
        const id = crypto.randomUUID();
        
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ type: 'embed', data: text, id });
        });
    }

    /**
     * Store embedding in IndexedDB
     */
    async saveEmbedding(id, text, vector, metadata = {}) {
        await this._initPromise;
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.put({
            id,
            text,
            vector,
            metadata,
            timestamp: Date.now()
        });
    }

    /**
     * Get all embeddings from DB
     */
    async getAllEmbeddings() {
        await this._initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(v1, v2) {
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }

    /**
     * Find most similar items
     */
    async findSimilar(targetVector, limit = 5) {
        const all = await this.getAllEmbeddings();
        const results = all.map(item => ({
            ...item,
            similarity: this.cosineSimilarity(targetVector, item.vector)
        }));

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Index a list of files from Git
     * @param {Array} items - List of items from loadRoutesFromGit
     * @param {Function} readFileFn - Function to read file content
     */
    async indexGitFiles(items, readFileFn) {
        console.log(`[VectorManager] Starting index for ${items.length} items...`);
        let count = 0;
        
        for (const item of items) {
            let textToEmbed = '';
            
            if (item.type === 'note' || item.type === 'link') {
                // Para notas/links, intentamos leer el contenido completo
                textToEmbed = await readFileFn(item.id) || item.name;
            } else {
                // Para rutas, usamos el nombre (embedding del JSON entero sería demasiado pesado/ruidoso)
                textToEmbed = item.name;
            }

            if (!textToEmbed || textToEmbed.length < 2) {
                count++;
                continue;
            }

            // Comprobar si ya lo tenemos indexado
            const existing = await this.getStoredEmbedding(item.id);
            if (existing) {
                count++;
                continue;
            }

            try {
                console.log(`[VectorManager] Embedding (${item.type}): ${item.name}`);
                const vector = await this.getEmbedding(textToEmbed);
                await this.saveEmbedding(item.id, textToEmbed, vector, { name: item.name, type: item.type });
            } catch (e) {
                console.error(`[VectorManager] Error embedding ${item.id}:`, e);
            }
            
            count++;
            window.dispatchEvent(new CustomEvent('vector-index-update', { 
                detail: { current: count, total: items.length, last: item.name } 
            }));
        }
        console.log('[VectorManager] Indexing complete.');
    }

    async getStoredEmbedding(id) {
        await this._initPromise;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }
}

export const vectorManager = new VectorManager();

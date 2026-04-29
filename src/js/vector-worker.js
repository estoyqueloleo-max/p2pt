import { pipeline, env } from '@huggingface/transformers';

// Configurar entorno para despliegue en navegador
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Singleton para manejar la instancia del pipeline
 */
class VectorPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { 
                progress_callback,
                // Podríamos usar webgpu si está disponible en el futuro
                // device: 'webgpu' 
            });
        }
        return this.instance;
    }
}

// Escuchar mensajes del hilo principal
self.addEventListener('message', async (event) => {
    const { type, data, id } = event.data;

    try {
        if (type === 'init') {
            await VectorPipeline.getInstance((progress) => {
                self.postMessage({ type: 'progress', data: progress, id });
            });
            self.postMessage({ type: 'ready', id });
        } 
        
        else if (type === 'embed') {
            const extractor = await VectorPipeline.getInstance();
            // Generar embedding (mean pooling y normalización L2 por defecto para este modelo)
            const output = await extractor(data, { pooling: 'mean', normalize: true });
            
            // Los tensores de transformers.js son objetos, necesitamos convertirlos a Array/Float32Array
            const vector = Array.from(output.data);
            
            self.postMessage({ 
                type: 'embed-result', 
                data: vector, 
                id 
            });
        }
    } catch (error) {
        console.error('[VectorWorker] Error:', error);
        self.postMessage({ type: 'error', data: error.message, id });
    }
});

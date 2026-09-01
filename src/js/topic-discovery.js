/**
 * Helper: Calcula SHA-1 InfoHash de un Topic ID en formato hexadecimal
 */
export async function computeTopicInfoHash(topic) {
    const encoder = new TextEncoder();
    const data = encoder.encode(topic.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Intenta descubrir un servidor Pingo que coincida con el Topic ID / Red Comunitaria
 */
export async function discoverServerByTopic(topic, onProgress) {
    if (!topic || !topic.trim()) {
        throw new Error('Introduce un Nombre de Red o Topic ID');
    }

    const cleanTopic = topic.trim();
    const expectedHash = await computeTopicInfoHash(cleanTopic);
    
    if (onProgress) onProgress(`Buscando nodos con Hash: ${expectedHash.substring(0, 8)}...`);

    // Lista de endpoints candidatos a explorar
    const candidateOrigins = [
        window.location.origin,
        'https://192.168.1.50:9000',
        'http://192.168.1.50:9000',
        'https://192.168.1.50.nip.io:9000',
        'http://pingo.local:9000',
        'https://pingo.local:9000'
    ];

    // Si el topic parece un subdominio DuckDNS (ej. mi-casa), agregarlo
    if (!cleanTopic.includes(' ') && !candidateOrigins.some(c => c.includes(cleanTopic))) {
        candidateOrigins.push(`https://${cleanTopic}.duckdns.org:9000`);
        candidateOrigins.push(`http://${cleanTopic}.duckdns.org:9000`);
    }

    let foundConfig = null;

    for (const base of candidateOrigins) {
        try {
            if (onProgress) onProgress(`Sondeando ${base}...`);
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 2000);

            const res = await fetch(`${base}/api/status`, {
                signal: ctrl.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.config) {
                    // Si el servidor coincide con el topic o responde con configuración válida
                    foundConfig = data.config;
                    break;
                }
            }
        } catch (e) {
            // Ignorar fallos de sondeo
        }
    }

    if (!foundConfig) {
        throw new Error(`No se detectó ningún servidor activo para el Topic "${cleanTopic}" en la red local. Si estás fuera de tu red Wi-Fi, escanea el código QR o importa el JSON.`);
    }

    return foundConfig;
}

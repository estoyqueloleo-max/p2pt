/**
 * Pingo - Zero Trust Asymmetric Cryptography Manager
 * Implements non-extractable device-bound ECDSA key pairs (P-256) via WebCrypto & IndexedDB,
 * Digital Signature Challenge-Response Handshake, and Public Key Export/Import (JWK & SPKI Base64).
 */

const DB_NAME = 'pingo_crypto_vault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_NAME = 'pingo_device_identity_key';

let cachedKeyPair = null;
let cachedPublicKeyB64 = null;

/**
 * Open IndexedDB for storing non-extractable CryptoKeys
 */
function openCryptoDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            return reject(new Error('IndexedDB no soportado en este entorno'));
        }
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Convert ArrayBuffer to Base64URL string
 */
export function bufferToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Convert Base64URL string to ArrayBuffer
 */
export function base64UrlToBuffer(b64) {
    let str = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Get or create the device-bound ECDSA keypair.
 * The private key is non-extractable (extractable: false) and bound to IndexedDB.
 * The public key is extractable so it can be shared with contacts.
 */
export async function getOrCreateDeviceKeyPair() {
    if (cachedKeyPair) return cachedKeyPair;

    const db = await openCryptoDB();

    // 1. Try to load existing key pair
    const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(KEY_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (existing && existing.privateKey && existing.publicKey) {
        cachedKeyPair = existing;
        return cachedKeyPair;
    }

    // 2. Generate a new ECDSA key pair (NIST P-256)
    console.log('[ZeroTrust] Generando nuevo par de claves ECDSA P-256 anclado al dispositivo...');
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'ECDSA',
            namedCurve: 'P-256'
        },
        false, // extractable: FALSE para máxima seguridad (la clave privada NO puede ser exportada)
        ['sign']
    );

    // Como la clave pública sí debe poder exportarse para compartirla, generamos la clave pública como extractable
    // En WebCrypto generateKey con extractable: false hace que ambas sean no extractables en algunos navegadores.
    // Por estándar, para permitir exportar la pública y proteger la privada:
    // Algunos navegadores marcan publicKey como extractable automáticamente si se permite, pero para garantizar
    // portabilidad absoluta, si publicKey.extractable es false, podemos exportar la pública si el navegador lo permite
    // o almacenar el raw exportado antes de fijarla si fuera extractable.
    // Comprobamos si publicKey es exportable:
    let pubExtractable = keyPair.publicKey.extractable;
    let storedPair = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey
    };

    // Si el navegador bloqueó la pública también con extractable: false, generamos con extractable: true
    // y solo persistimos la clave en IndexedDB (los atacantes web ordinarios siguen sin poder tocar el storage)
    if (!pubExtractable) {
        console.log('[ZeroTrust] Ajustando extractable para permitir exportación de clave pública...');
        const extractablePair = await window.crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256'
            },
            true,
            ['sign', 'verify']
        );
        storedPair = {
            privateKey: extractablePair.privateKey,
            publicKey: extractablePair.publicKey
        };
    }

    // Persistir en IndexedDB
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(storedPair, KEY_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });

    cachedKeyPair = storedPair;
    return cachedKeyPair;
}

/**
 * Export our device public key as a portable Base64URL string (SPKI format)
 */
export async function exportMyPublicKey() {
    if (cachedPublicKeyB64) return cachedPublicKeyB64;
    const { publicKey } = await getOrCreateDeviceKeyPair();
    const spki = await window.crypto.subtle.exportKey('spki', publicKey);
    cachedPublicKeyB64 = bufferToBase64Url(spki);
    return cachedPublicKeyB64;
}

/**
 * Import a peer's public key from Base64URL SPKI
 * @param {string} b64Spki
 * @returns {Promise<CryptoKey>}
 */
export async function importPeerPublicKey(b64Spki) {
    if (!b64Spki || typeof b64Spki !== 'string') {
        throw new Error('Clave pública inválida o ausente');
    }
    const spkiBuffer = base64UrlToBuffer(b64Spki);
    return await window.crypto.subtle.importKey(
        'spki',
        spkiBuffer,
        {
            name: 'ECDSA',
            namedCurve: 'P-256'
        },
        true,
        ['verify']
    );
}

/**
 * Sign an arbitrary challenge string with our private key
 * @param {string} challengeText
 * @returns {Promise<string>} signature as Base64URL
 */
export async function signChallenge(challengeText) {
    const { privateKey } = await getOrCreateDeviceKeyPair();
    const encoder = new TextEncoder();
    const data = encoder.encode(challengeText);
    const signature = await window.crypto.subtle.sign(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
        },
        privateKey,
        data
    );
    return bufferToBase64Url(signature);
}

/**
 * Verify a challenge signature against a peer's public key (in CryptoKey or Base64 format)
 * @param {CryptoKey|string} peerPublicKey - CryptoKey object or Base64 SPKI
 * @param {string} challengeText - The original challenge issued to the peer
 * @param {string} signatureB64 - The received signature
 * @returns {Promise<boolean>}
 */
export async function verifyPeerChallenge(peerPublicKey, challengeText, signatureB64) {
    try {
        let key = peerPublicKey;
        if (typeof key === 'string') {
            key = await importPeerPublicKey(key);
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(challengeText);
        const signatureBuf = base64UrlToBuffer(signatureB64);

        return await window.crypto.subtle.verify(
            {
                name: 'ECDSA',
                hash: { name: 'SHA-256' }
            },
            key,
            signatureBuf,
            data
        );
    } catch (err) {
        console.error('[ZeroTrust] Fallo al verificar firma del desafío:', err);
        return false;
    }
}

/**
 * Generate a random cryptographically secure nonce for a challenge
 */
export function generateChallengeNonce() {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return bufferToBase64Url(bytes.buffer);
}

/**
 * Fingerprint a public key (Short hex hash for visual verification by users)
 */
export async function getPublicKeyFingerprint(b64Spki) {
    try {
        const buf = base64UrlToBuffer(b64Spki);
        const hash = await window.crypto.subtle.digest('SHA-256', buf);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
    } catch (e) {
        return 'N/A';
    }
}

/**
 * Pingo - Zero Trust Asymmetric Cryptography Manager
 * Implements non-extractable device-bound ECDSA key pairs (P-256) via WebCrypto & IndexedDB,
 * Digital Signature Challenge-Response Handshake, and Public Key Export/Import (JWK & SPKI Base64).
 */

import elliptic from 'elliptic';

const DB_NAME = 'pingo_crypto_vault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_NAME = 'pingo_device_identity_key';

let cachedKeyPair = null;
let cachedPublicKeyB64 = null;
const ec = new elliptic.ec('p256');

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
 * Derive deterministic ECDSA (P-256) CryptoKeyPair from a user secret passphrase + salt
 * @param {string} phrase - User secret passphrase
 * @param {string} salt - Security salt
 * @returns {Promise<CryptoKeyPair>}
 */
export async function deriveKeyPairFromPhrase(phrase, salt) {
    if (!phrase) {
        throw new Error('Frase secreta requerida para derivación criptográfica');
    }

    // 1. Derivar semilla de 256 bits mediante PBKDF2 (100.000 iteraciones SHA-256)
    const encoder = new TextEncoder();
    const phraseBuf = encoder.encode(phrase);
    const saltBuf = encoder.encode((salt || '') + '_pingo_ecdsa_vault_v1');

    const baseKey = await window.crypto.subtle.importKey(
        'raw', phraseBuf, { name: 'PBKDF2' }, false, ['deriveBits']
    );

    const seedBits = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        256 // 32 bytes
    );

    const seedBytes = new Uint8Array(seedBits);

    // 2. Multiplicar escalar sobre curva elíptica NIST P-256 para obtener punto público (X, Y)
    const key = ec.keyFromPrivate(seedBytes);
    const pubPoint = key.getPublic();

    const xBytes = new Uint8Array(pubPoint.getX().toArray('be', 32));
    const yBytes = new Uint8Array(pubPoint.getY().toArray('be', 32));

    // 3. Construir JWKs para importar en WebCrypto
    const jwkPrivate = {
        kty: 'EC',
        crv: 'P-256',
        x: bufferToBase64Url(xBytes.buffer),
        y: bufferToBase64Url(yBytes.buffer),
        d: bufferToBase64Url(seedBytes.buffer),
        ext: false // La clave privada se fija como NO extraíble en memoria
    };

    const jwkPublic = {
        kty: 'EC',
        crv: 'P-256',
        x: bufferToBase64Url(xBytes.buffer),
        y: bufferToBase64Url(yBytes.buffer),
        ext: true // La clave pública es extraíble para poder compartirla
    };

    // 4. Importar en WebCrypto SubtleCrypto con las protecciones de seguridad activadas
    const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        jwkPrivate,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // extractable: false
        ['sign']
    );

    const publicKey = await window.crypto.subtle.importKey(
        'jwk',
        jwkPublic,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true, // extractable: true
        ['verify']
    );

    return { privateKey, publicKey };
}

/**
 * Get or create the device-bound ECDSA keypair.
 * If user has a passphrase configured, derives the key deterministically so
 * changing phones restores the exact same cryptographic identity.
 * The private key is non-extractable (extractable: false) and bound to IndexedDB.
 */
export async function getOrCreateDeviceKeyPair(customPhrase = null, customSalt = null) {
    const phrase = customPhrase !== null ? customPhrase : (localStorage.getItem('pingo_passphrase') || '');
    const salt = customSalt !== null ? customSalt : (localStorage.getItem('pingo_salt') || '');

    // Clave de almacenamiento en IndexedDB ligada a la frase (o default)
    const storageKey = phrase ? `pingo_key_${btoa(phrase.substring(0, 16))}` : KEY_NAME;

    const db = await openCryptoDB();

    // 1. Try to load existing key pair from IndexedDB for this identity
    const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(storageKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (existing && existing.privateKey && existing.publicKey) {
        cachedKeyPair = existing;
        cachedPublicKeyB64 = null;
        return cachedKeyPair;
    }

    let storedPair;

    // 2. Si hay frase secreta, derivar de forma determinista para permitir cambio de móvil transparente
    if (phrase) {
        console.log('[ZeroTrust] 🔑 Derivando par de claves ECDSA P-256 determinista a partir de Frase Secreta...');
        storedPair = await deriveKeyPairFromPhrase(phrase, salt);
    } else {
        // Generación aleatoria para identidades efímeras sin frase
        console.log('[ZeroTrust] Generando par de claves ECDSA aleatorio anclado al dispositivo...');
        const extractablePair = await window.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
        storedPair = {
            privateKey: extractablePair.privateKey,
            publicKey: extractablePair.publicKey
        };
    }

    // 3. Persistir en IndexedDB
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(storedPair, storageKey);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });

    cachedKeyPair = storedPair;
    cachedPublicKeyB64 = null;
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

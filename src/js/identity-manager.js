/**
 * Pingo - Identity & Agenda Management
 */

import { state, elements } from './state.js';
import { derivePeerId, updateLocationStatus } from './utils.js';

export function loadIdentity() {
    try {
        state.myIdentity.phrase = localStorage.getItem('pingo_passphrase') || '';
        state.myIdentity.salt = localStorage.getItem('pingo_salt') || '';
        state.myIdentity.alias = localStorage.getItem('pingo_alias') || '';
        if (elements.identityPhrase) elements.identityPhrase.value = state.myIdentity.phrase;
        if (elements.identitySalt) elements.identitySalt.value = state.myIdentity.salt;
        if (elements.identityAlias) elements.identityAlias.value = state.myIdentity.alias;
    } catch (e) {
        console.error('Error loading identity:', e);
    }
}

export async function saveIdentity() {
    const phrase = elements.identityPhrase.value.trim();
    const salt = elements.identitySalt.value.trim();
    const alias = elements.identityAlias ? elements.identityAlias.value.trim() : '';

    if (!phrase) {
        alert('Por favor, introduce una frase secreta.');
        return;
    }

    state.myIdentity = { phrase, salt, alias };
    localStorage.setItem('pingo_passphrase', phrase);
    localStorage.setItem('pingo_salt', salt);
    localStorage.setItem('pingo_alias', alias);

    const newId = await derivePeerId(phrase, salt);
    if (newId) {
        localStorage.setItem('pingo_my_id', newId);
        updateLocationStatus('Identidad actualizada. Reiniciando...', 'fa-fingerprint');
        setTimeout(() => window.location.reload(), 1500);
    }
}

export function loadAgenda() {
    try {
        const saved = localStorage.getItem('pingo_agenda');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                state.agenda = parsed;
            }
        }
        console.log(`Loaded ${state.agenda.length} contacts from agenda.`);
    } catch (e) {
        console.error('Error loading agenda:', e);
        state.agenda = [];
    }
}

export function saveAgenda() {
    localStorage.setItem('pingo_agenda', JSON.stringify(state.agenda));
}

export function getAliasForPeer(peerId) {
    if (peerId === 'Android') return 'Bandeja Compartida';
    const contact = state.agenda.find(c => c.derivedId === peerId);
    return contact ? contact.alias : null;
}

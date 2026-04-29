/**
 * Pingo - Git Traceability Manager
 * Uses isomorphic-git and lightning-fs
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import pako from 'pako';
import { getGitProxyUrl } from './sync-manager.js';

const FS_NAME = 'pingo-fs';
const REPO_DIR = '/routes-repo';

// Initialize Filesystem
const fs = new LightningFS(FS_NAME);
const pfs = fs.promises;

/**
 * Initialize the Git repository if it doesn't exist
 */
export async function initGitRepo() {
    try {
        await pfs.mkdir(REPO_DIR);
    } catch (err) {
        // Directory already exists, likely repo too
    }

    try {
        await git.init({ fs, dir: REPO_DIR, defaultBranch: 'main' });
        console.log('[Git] Repo initialized or verified.');
    } catch (err) {
        console.error('[Git] Init error:', err);
    }
}

/**
 * Save a route to the filesystem and commit it
 * @param {string} routeId 
 * @param {object} routeData 
 * @param {string} message 
 */
export async function commitRoute(routeId, routeData, message) {
    const filename = `${routeId}.json`;
    const filepath = `${REPO_DIR}/${filename}`;
    
    try {
        // Asegurar que el repo existe e iniciar si es necesario
        await initGitRepo();

        // Write file
        await pfs.writeFile(filepath, JSON.stringify(routeData, null, 2));
        
        // Git Add
        await git.add({ fs, dir: REPO_DIR, filepath: filename });
        
        // Git Commit
        const sha = await git.commit({
            fs,
            dir: REPO_DIR,
            author: {
                name: 'Pingo User',
                email: 'user@pingo.local'
            },
            message: message || `Update route: ${routeData.name || routeId}`
        });
        
        console.log(`[Git] Committed ${filename}. SHA: ${sha}`);
        return sha;
    } catch (err) {
        console.error('[Git] Commit error:', err);
        throw err;
    }
}

/**
 * Save an arbitrary text file to the filesystem and commit it (e.g. YouTube links)
 */
export async function commitLinkFile(filename, content) {
    const filepath = `${REPO_DIR}/${filename}`;
    
    try {
        // Asegurar que el repo existe e iniciar si es necesario
        await initGitRepo();

        await pfs.writeFile(filepath, content);
        await git.add({ fs, dir: REPO_DIR, filepath: filename });
        
        const sha = await git.commit({
            fs,
            dir: REPO_DIR,
            author: { name: 'Pingo YouTube', email: 'user@pingo.local' },
            message: `Save captured link: ${filename}`
        });
        
        console.log(`[Git] Committed text file ${filename}. SHA: ${sha}`);
        return sha;
    } catch (err) {
        console.error('[Git] Commit text file error:', err);
        throw err;
    }
}


/**
 * Get the commit history for a specific route (file)
 * @param {string} routeId 
 */
export async function getRouteLog(routeId) {
    const filename = `${routeId}.json`;
    try {
        const commits = await git.log({ fs, dir: REPO_DIR });
        // Filter commits that touched this file
        // Note: isomorphic-git log is just the commit list. 
        // For per-file log, we'd need to walk the tree, but for now we return all.
        return commits;
    } catch (err) {
        console.error('[Git] Log error:', err);
        return [];
    }
}

/**
 * Read the current version of a route from the filesystem
 */
export async function readRouteFile(routeId) {
    const filepath = `${REPO_DIR}/${routeId}.json`;
    try {
        const data = await pfs.readFile(filepath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Git] Read error:', err);
        return null;
    }
}

/**
 * Read raw content of a file
 */
export async function readRawFile(filename) {
    const filepath = `${REPO_DIR}/${filename}`;
    try {
        return await pfs.readFile(filepath, 'utf8');
    } catch (err) {
        console.error('[Git] Raw Read error:', err);
        return null;
    }
}

/**
 * Create a bundle (zip) of the repository for P2P sharing
 */
export async function createRepoSnapshot() {
    // This is a simplified version: we zip the .git folder
    // In a more advanced version, we'd use git.bundle
    try {
        // Recursive list or just use a helper to get all objects
        // For P2P sharing, sending the .git folder is heavy.
        // We'll implement a custom "Object Pack" if needed.
        // For now, let's export the specific route file and its last commit SHA.
        return null; // TODO: Implement robust bundling
    } catch (err) {
        console.error('[Git] Bundle error:', err);
        return null;
    }
}

/**
 * Push local commits to a remote repository
 * @param {string} remoteUrl 
 * @param {string} username 
 * @param {string} token 
 */
export async function pushToRemote(remoteUrl, username, token) {
    if (!remoteUrl) throw new Error('URL remota no configurada');

    // Use our Cloudflare Proxy to bypass CORS
    const proxiedUrl = getGitProxyUrl(remoteUrl);
    
    // Detect current branch
    let branch = 'main';
    try {
        branch = await git.currentBranch({ fs, dir: REPO_DIR }) || 'main';
    } catch (e) {
        console.warn('[Git] Could not detect current branch, defaulting to main');
    }

    console.log(`[Git] Pushing branch ${branch} to ${proxiedUrl}`);

    try {
        // 1. Add remote if it doesn't exist
        try {
            await git.addRemote({ fs, dir: REPO_DIR, remote: 'origin', url: proxiedUrl });
        } catch (e) {
            // Already exists, update it
            await git.deleteRemote({ fs, dir: REPO_DIR, remote: 'origin' });
            await git.addRemote({ fs, dir: REPO_DIR, remote: 'origin', url: proxiedUrl });
        }

        // 2. Push
        const result = await git.push({
            fs,
            http,
            dir: REPO_DIR,
            remote: 'origin',
            ref: branch,
            force: false, // Default is safe
            onAuth: () => ({ username, password: token })
        });

        console.log('[Git] Push successful:', result);
        return result;
    } catch (err) {
        if (err.name === 'PushRejectedError') {
            const remoteCommit = await git.resolveRef({ fs, dir: REPO_DIR, ref: `origin/${branch}` }).catch(() => 'unknown');
            throw new Error(`Push rechazado: El servidor tiene cambios que tú no tienes (Head: ${remoteCommit.substring(0,7)}). Por favor, pulsa "Bajar ⬇️" primero.`);
        }
        console.error('[Git] Push error:', err);
        throw err;
    }
}

/**
 * Pull and merge commits from a remote repository
 * @param {string} remoteUrl 
 * @param {string} username 
 * @param {string} token 
 */
export async function pullFromRemote(remoteUrl, username, token) {
    if (!remoteUrl) throw new Error('URL remota no configurada');

    const proxiedUrl = getGitProxyUrl(remoteUrl);
    
    // Check if repo is empty (needs clone) or has commits (needs pull)
    let needsClone = false;
    try {
        await git.resolveRef({ fs, dir: REPO_DIR, ref: 'HEAD' });
    } catch (e) {
        console.log('[Git] Repository is empty or no HEAD found. Will attempt clone.');
        needsClone = true;
    }

    try {
        if (needsClone) {
            console.log('[Git] Cold start: Cloning from', proxiedUrl);
            
            // Clean up directory just in case it has untracked files causing conflicts
            const entries = await pfs.readdir(REPO_DIR).catch(() => []);
            for (const entry of entries) {
                if (entry === '.git') continue; // Don't delete .git if it was partially init'd
                // For a truly clean clone, isomorphic-git prefers an empty dir or one it manages.
                // But for now let's just let clone try to handle it.
            }

            return await git.clone({
                fs,
                http,
                dir: REPO_DIR,
                url: proxiedUrl,
                singleBranch: true,
                depth: 1,
                onAuth: () => ({ username, password: token })
            });
        }

        // --- NORMAL PULL LOGIC ---
        // Detect current branch
        let branch = 'main';
        try {
            branch = await git.currentBranch({ fs, dir: REPO_DIR }) || 'main';
        } catch (e) {
            console.warn('[Git] Could not detect current branch for Pull, defaulting to main');
        }

        console.log(`[Git] Pulling branch ${branch} from ${proxiedUrl}`);

        // Ensure remote exists
        try {
            await git.addRemote({ fs, dir: REPO_DIR, remote: 'origin', url: proxiedUrl });
        } catch (e) {
            await git.deleteRemote({ fs, dir: REPO_DIR, remote: 'origin' });
            await git.addRemote({ fs, dir: REPO_DIR, remote: 'origin', url: proxiedUrl });
        }

        const result = await git.pull({
            fs,
            http,
            dir: REPO_DIR,
            remote: 'origin',
            ref: branch,
            fastForwardOnly: false,
            author: { name: 'Pingo Sync', email: 'sync@pingo.local' },
            onAuth: () => ({ username, password: token })
        });

        console.log('[Git] Pull successful:', result);
        return result;
    } catch (err) {
        console.error('[Git] Pull error:', err);
        throw err;
    }
}

/**
 * Diagnostic helper to see what's happening
 */
export async function getGitStatus() {
    try {
        const branch = await git.currentBranch({ fs, dir: REPO_DIR });
        const log = await git.log({ fs, dir: REPO_DIR, depth: 5 }).catch(() => []);
        const remotes = await git.listRemotes({ fs, dir: REPO_DIR }).catch(() => []);
        
        console.table({
            branch: branch || 'unknown',
            lastCommit: log[0]?.commit.message || 'no commits',
            remotes: remotes.map(r => r.remote).join(', ') || 'none'
        });
        
        return { branch, log, remotes };
    } catch (err) {
        console.warn('[Git] Status error:', err);
        return null;
    }
}

/**
 * Handle extreme conflicts by forcing a state
 * @param {'local'|'remote'} type 
 */
export async function forceSyncWithRemote(type, remoteUrl, username, token) {
    const proxiedUrl = getGitProxyUrl(remoteUrl);
    let branch = 'main';
    try { branch = await git.currentBranch({ fs, dir: REPO_DIR }) || 'main'; } catch(e) {}

    if (type === 'local') {
        console.warn('[Git] Forcing LOCAL version to remote...');
        return await git.push({
            fs,
            http,
            dir: REPO_DIR,
            remote: 'origin',
            ref: branch,
            force: true,
            onAuth: () => ({ username, password: token })
        });
    }

    if (type === 'remote') {
        console.warn('[Git] Wiping local and forcing REMOTE version...');
        // 1. Wipe everything
        const files = await pfs.readdir(REPO_DIR);
        for (const file of files) {
            await pfs.unlink(`${REPO_DIR}/${file}`).catch(() => {});
            if (file === '.git') {
                // Recursive delete .git is harder with pfs, we'll just re-clone over it
            }
        }
        
        // 2. Fresh clone is the most reliable way to reset state in LightningFS
        // But first delete REPO_DIR to be clean
        await (async function deleteDir(d) {
            const entries = await pfs.readdir(d);
            for (const entry of entries) {
                const path = `${d}/${entry}`;
                const stat = await pfs.lstat(path);
                if (stat.isDirectory()) await deleteDir(path);
                else await pfs.unlink(path);
            }
            // Not strictly necessary to delete the root REPO_DIR itself
        })(REPO_DIR).catch(() => {});

        await git.clone({
            fs,
            http,
            dir: REPO_DIR,
            url: proxiedUrl,
            ref: branch,
            singleBranch: true,
            depth: 1,
            onAuth: () => ({ username, password: token })
        });
        
        return { success: true };
    }
}

/**
 * Scan the repository for .json files and reload them into a list
 */
export async function loadRoutesFromGit() {
    try {
        const files = await pfs.readdir(REPO_DIR);
        // Filtramos tanto JSON (rutas) como TXT (links capturados)
        const allFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.txt'));
        const items = [];

        for (const file of allFiles) {
            const content = await pfs.readFile(`${REPO_DIR}/${file}`, 'utf8');
            if (file.endsWith('.json')) {
                try {
                    const data = JSON.parse(content);
                    data.type = 'route'; // Aseguramos tipo para la UI
                    items.push(data);
                } catch (e) {
                    console.error(`[Git] Failed to parse ${file}:`, e);
                }
            } else if (file.endsWith('.txt')) {
                const tsMatch = file.match(/(?:link|note)-(\d+)\.txt/);
                const timestamp = tsMatch ? parseInt(tsMatch[1]) : Date.now();
                const isLink = file.startsWith('link-');
                const type = isLink ? 'link' : 'note';
                
                const lines = content.split('\n');
                let title = 'Nota';
                let url = '';

                if (isLink) {
                    title = lines[0]?.replace('Titulo: ', '') || 'Link capturado';
                    url = lines[1]?.replace('URL: ', '') || '';
                } else {
                    title = lines[0]?.replace('Titulo: ', '') || 'Nota';
                    if (title.length > 30) title = title.substring(0, 27) + '...';
                }
                
                items.push({
                    id: file,
                    type: type,
                    name: title,
                    url: url,
                    timestamp: timestamp,
                    stats: { points: 0 } 
                });
            }
        }
        
        // Ordenar por tiempo descendente
        return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
        console.error('[Git] List items error:', err);
        return [];
    }
}

/**
 * Completely wipe the local repository directory
 */
export async function deleteGitRepo() {
    async function recursiveDelete(d) {
        const entries = await pfs.readdir(d);
        for (const entry of entries) {
            const path = `${d}/${entry}`;
            const stat = await pfs.lstat(path);
            if (stat.isDirectory()) {
                await recursiveDelete(path);
                await pfs.rmdir(path);
            } else {
                await pfs.unlink(path);
            }
        }
    }
    
    try {
        console.warn('[Git] Wiping local repository...');
        await recursiveDelete(REPO_DIR);
        // Also remove the root dir if possible (or just keep it empty)
        console.log('[Git] Local repository wiped successfully.');
        return true;
    } catch (err) {
        console.error('[Git] Error wiping repository:', err);
        // If it failed because it doesn't exist, that's fine too
        return true; 
    }
}

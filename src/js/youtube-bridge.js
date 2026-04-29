import { commitLinkFile, loadRoutesFromGit, readRawFile } from './git-manager.js';
import { state } from './state.js';
import { renderRoutes } from './ui-manager.js';

export function setupYouTubeBridge() {
    const btn = document.getElementById('btn-open-youtube');
    if(!btn) return;
    
    btn.addEventListener('click', () => {
        // En entorno Nativo, cordova existe
        if (window.cordova && window.cordova.InAppBrowser) {
            const browser = window.cordova.InAppBrowser.open('https://m.youtube.com', '_blank', 'location=no,hidden=no');
            
            browser.addEventListener('loadstop', () => {
                browser.executeScript({
                    code: `
                    let longPressTimer;
                    const LONG_PRESS_DURATION = 800; // ms

                    function startPress(e) {
                        let link = e.target.closest('a');
                        if (!link) return;

                        longPressTimer = setTimeout(() => {
                            const defaultTitle = e.target.innerText || link.innerText || "Link de YouTube";
                            const userTitle = window.prompt("¿Cómo quieres llamar a este link?", defaultTitle.trim());
                            
                            if (userTitle !== null) {
                                webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                    url: link.href,
                                    texto: userTitle || defaultTitle
                                }));
                            }
                            longPressTimer = null;
                        }, LONG_PRESS_DURATION);
                    }

                    function cancelPress() {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    }

                    window.addEventListener('mousedown', startPress, true);
                    window.addEventListener('touchstart', startPress, true);
                    window.addEventListener('mouseup', cancelPress, true);
                    window.addEventListener('touchend', cancelPress, true);
                    window.addEventListener('touchmove', cancelPress, true);
                    `
                });
            });

            browser.addEventListener('message', async (params) => {
                try {
                    const data = params.data;
                    console.log("Clic de YouTube Interceptado:", data);
                    
                    if (data.url) {
                        const isAppending = state.workingFile && state.workingFile.type === 'link';
                        const fileName = isAppending ? state.workingFile.id : `link-${Date.now()}.txt`;
                        const newEntry = `Titulo: ${data.texto}\nURL: ${data.url}\nFecha: ${new Date().toLocaleString()}\n`;
                        
                        let fileContent = newEntry;
                        if (isAppending) {
                            const currentContent = await readRawFile(fileName) || "";
                            fileContent = currentContent + "\n" + newEntry;
                        }

                        await commitLinkFile(fileName, fileContent);
                        console.log(`${isAppending ? 'Append' : 'Nuevo'} link guardado en Git como ${fileName}`);
                        
                        // Actualizar estado y UI
                        state.routes = await loadRoutesFromGit();
                        renderRoutes();

                        // Opcional: Feedback visual en PWA
                        alert(`¡Link guardado exitosamente!\n${data.texto}`);
                    }
                } catch (e) {
                    console.error("Error guardando link de YouTube:", e);
                }
            });
        } else {
            console.warn("Falta InAppBrowser. Estás en la web. Haciendo mockup.");
            alert("En la App Web pura no se puede interceptar YouTube (CORS).\nAbre la App Nativa compilada con Capacitor.\n\nPara probar la lógica, crearemos un link de prueba en el Git.");
            
            const isAppending = state.workingFile && state.workingFile.type === 'link';
            const fileName = isAppending ? state.workingFile.id : `link-mock-${Date.now()}.txt`;
            const newEntry = `Titulo: Mock Video\nURL: https://m.youtube.com/watch?v=mock\nFecha: ${new Date().toLocaleString()}\n`;
            
            (async () => {
                let fileContent = newEntry;
                if (isAppending) {
                    const currentContent = await readRawFile(fileName) || "";
                    fileContent = currentContent + "\n" + newEntry;
                }
                
                await commitLinkFile(fileName, fileContent);
            })().then(async () => {
                console.log("Link Mock guardado en Pingo");
                state.routes = await loadRoutesFromGit();
                renderRoutes();
            }).catch(console.error);
        }
    });
}

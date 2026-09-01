import jsQR from 'jsqr';

let currentStream = null;
let scanAnimationId = null;

/**
 * Inicia el escáner de cámara para leer códigos QR
 */
export async function startCameraQRScanner(videoEl, canvasEl, feedbackEl, onScanSuccess) {
    stopCameraQRScanner();

    try {
        if (feedbackEl) feedbackEl.textContent = 'Solicitando acceso a la cámara...';
        
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 640 },
                height: { ideal: 640 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', true);
        await videoEl.play();

        if (feedbackEl) feedbackEl.textContent = 'Enfoca el código QR del Dashboard...';

        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

        const scanFrame = () => {
            if (!currentStream || videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
                scanAnimationId = requestAnimationFrame(scanFrame);
                return;
            }

            canvasEl.width = videoEl.videoWidth;
            canvasEl.height = videoEl.videoHeight;
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

            const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
                if (feedbackEl) feedbackEl.innerHTML = '<b>¡Código QR detectado! ✅</b>';
                stopCameraQRScanner();
                onScanSuccess(code.data);
                return;
            }

            scanAnimationId = requestAnimationFrame(scanFrame);
        };

        scanAnimationId = requestAnimationFrame(scanFrame);
    } catch (err) {
        console.error('[QRScanner] Error accediendo a la cámara:', err);
        if (feedbackEl) feedbackEl.innerHTML = `<span style="color:#ef4444;">Error de cámara: ${err.message}. Usa "Subir Imagen" o escribe a mano.</span>`;
    }
}

/**
 * Detiene la cámara y el bucle de escaneo
 */
export function stopCameraQRScanner() {
    if (scanAnimationId) {
        cancelAnimationFrame(scanAnimationId);
        scanAnimationId = null;
    }
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

/**
 * Escanea un archivo de imagen estático para buscar código QR
 */
export async function scanImageFile(file, canvasEl) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                canvasEl.width = img.width;
                canvasEl.height = img.height;
                const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) {
                    resolve(code.data);
                } else {
                    reject(new Error('No se detectó ningún código QR en la imagen seleccionada.'));
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

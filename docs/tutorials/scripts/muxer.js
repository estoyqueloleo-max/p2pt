/**
 * Video & Audio Muxer using FFmpeg
 * Merges raw Playwright WebM screen recording with Kokoro TTS audio into final MP4.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Merge video and audio into a polished, production-ready MP4 file
 * @param {string} rawVideoPath - Input Playwright .webm video
 * @param {string} audioPath - Input Kokoro .wav audio track
 * @param {string} outputPath - Output .mp4 video file
 */
export function muxVideoAudio(rawVideoPath, audioPath, outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`🎬 [Muxer] Combinando vídeo (${path.basename(rawVideoPath)}) y locución (${path.basename(audioPath)})...`);

    // 1. Obtener la duración exacta del audio master en segundos
    let audioDurationSec = 0;
    try {
        const durationOutput = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
            { encoding: 'utf8' }
        ).trim();
        audioDurationSec = parseFloat(durationOutput);
    } catch (e) {
        console.warn(`⚠️ [Muxer] No se pudo leer duración con ffprobe:`, e.message);
    }

    // 2. Muxing con FFmpeg:
    // - tpad extiende el vídeo congelando el último fotograma si el vídeo es más corto que la locución.
    // - Se elimina -shortest para que la voz JAMÁS se corte a mitad de frase.
    // - Si tenemos duración de audio, fijamos la duración exacta con un pequeño margen de 0.5s de respiro.
    const durationFlag = (audioDurationSec > 0) ? `-t ${(audioDurationSec + 0.5).toFixed(2)}` : '';
    const filterComplex = `[0:v]tpad=stop_mode=clone:stop_duration=15,fps=30[v];[1:a]loudnorm=I=-16:LRA=11:TP=-1.5[aout]`;

    const ffmpegCmd = `ffmpeg -y \
        -i "${rawVideoPath}" \
        -i "${audioPath}" \
        -filter_complex "${filterComplex}" \
        -map "[v]" \
        -map "[aout]" \
        -c:v libx264 \
        -preset fast \
        -crf 20 \
        -pix_fmt yuv420p \
        -c:a aac \
        -b:a 192k \
        ${durationFlag} \
        "${outputPath}"`;

    try {
        execSync(ffmpegCmd, { stdio: 'pipe' });
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
            console.log(`✅ [Muxer] Vídeo final generado: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
            return outputPath;
        }
    } catch (e) {
        console.error(`❌ [Muxer Error] Error al ejecutar FFmpeg:`, e.message);
    }

    return null;
}

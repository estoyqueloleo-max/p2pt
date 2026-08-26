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

    const ffmpegCmd = `ffmpeg -y \
        -i "${rawVideoPath}" \
        -i "${audioPath}" \
        -c:v libx264 \
        -preset fast \
        -crf 20 \
        -pix_fmt yuv420p \
        -c:a aac \
        -b:a 192k \
        -filter_complex "[1:a]loudnorm=I=-16:LRA=11:TP=-1.5[aout]" \
        -map 0:v:0 \
        -map "[aout]" \
        -shortest \
        "${outputPath}" 2>/dev/null || ffmpeg -y \
        -i "${rawVideoPath}" \
        -i "${audioPath}" \
        -c:v libx264 \
        -pix_fmt yuv420p \
        -c:a aac \
        -b:a 192k \
        -shortest \
        "${outputPath}" 2>/dev/null`;

    try {
        execSync(ffmpegCmd);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
            console.log(`✅ [Muxer] Vídeo final generado: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
            return outputPath;
        }
    } catch (e) {
        console.error(`❌ [Muxer Error] Error al ejecutar FFmpeg:`, e.message);
    }

    return null;
}

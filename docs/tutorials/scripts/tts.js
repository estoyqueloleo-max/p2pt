/**
 * TTS Generator using Kokoro ONNX Model
 * Generates spoken audio segments from voiceover script text.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DOCKER_KOKORO_URL = 'http://localhost:8880/v1/audio/speech';
const KOKORO_MODEL_PATH = '/home/jose/tts-stt/livekit/models/kokoro-v0_19.onnx';
const KOKORO_VOICES_PATH = '/home/jose/tts-stt/livekit/models/voices-v1.0.bin';

/**
 * Generate audio for a single voiceover string
 * @param {string} text - Voiceover text to synthesize
 * @param {string} outputPath - Destination audio file
 * @param {string} voice - Voice profile (e.g. 'em_alex' or 'ef_dora')
 */
export async function generateSpeech(text, outputPath, voice = 'em_alex') {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`🎙️ [Kokoro TTS (${voice})] Generando audio: "${text.substring(0, 50)}..."`);

    // 1. Método Principal: Conexión al contenedor Docker local (localhost:8880)
    try {
        const response = await fetch(DOCKER_KOKORO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: text,
                voice: voice,
                model: 'kokoro',
                speed: 1.0,
                response_format: 'wav'
            })
        });

        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > 500) {
                fs.writeFileSync(outputPath, buffer);
                return outputPath;
            }
        }
    } catch (e) {
        // Si el contenedor Docker no responde, intentamos con ONNX local
    }

    // 2. Método Secundario: Kokoro ONNX nativo local
    if (fs.existsSync(KOKORO_MODEL_PATH) && fs.existsSync(KOKORO_VOICES_PATH)) {
        try {
            const pyScript = `
import sys
from kokoro_onnx import Kokoro
import soundfile as sf
kokoro = Kokoro("${KOKORO_MODEL_PATH}", "${KOKORO_VOICES_PATH}")
samples, sample_rate = kokoro.create("""${text.replace(/"/g, '\\"')}""", voice="${voice}", speed=1.0, lang="es")
sf.write("${outputPath}", samples, sample_rate)
`;
            execSync(`python3 -c '${pyScript}' 2>/dev/null`);
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                return outputPath;
            }
        } catch (e) {
            // Ignorar y pasar a fallback
        }
    }

    // Fallback: Si no está kokoro_onnx en el python global, generar audio TTS con pico2wave o ffmpeg
    try {
        const escapedText = text.replace(/"/g, '\\"');
        execSync(`pico2wave -l es-ES -w "${outputPath}" "${escapedText}" 2>/dev/null || espeak-ng -v es -w "${outputPath}" "${escapedText}" 2>/dev/null`);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
            return outputPath;
        }
    } catch (e) {
        // Fallback final: generar tono/silencio con duración equivalente para permitir el muxing
    }

    // Fallback silencioso con duración estimada
    const estimatedDurationSec = Math.max(2, Math.ceil(text.split(' ').length / 2.8));
    execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${estimatedDurationSec} -q:a 9 -acodec pcm_s16le "${outputPath}" 2>/dev/null`);
    return outputPath;
}

/**
 * Concatenate multiple audio segment files into a single unified track
 */
export function concatAudioSegments(segmentFiles, finalAudioPath) {
    const listFile = path.join(path.dirname(finalAudioPath), 'concat_list.txt');
    const content = segmentFiles.map(f => `file '${path.resolve(f)}'`).join('\n');
    fs.writeFileSync(listFile, content);

    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${finalAudioPath}" 2>/dev/null || ffmpeg -y -f concat -safe 0 -i "${listFile}" "${finalAudioPath}" 2>/dev/null`);
    return finalAudioPath;
}

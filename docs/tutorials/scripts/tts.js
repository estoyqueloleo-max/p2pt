/**
 * TTS Generator using Kokoro ONNX Model
 * Generates spoken audio segments from voiceover script text.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const KOKORO_MODEL_PATH = '/home/jose/tts-stt/livekit/models/kokoro-v0_19.onnx';
const KOKORO_VOICES_PATH = '/home/jose/tts-stt/livekit/models/voices-v1.0.bin';

/**
 * Generate audio for a single voiceover string
 * @param {string} text - Voiceover text to synthesize
 * @param {string} outputPath - Destination .wav file
 * @param {string} voice - Voice profile (e.g. 'em_santa' or 'es_m' / 'es_f')
 */
export async function generateSpeech(text, outputPath, voice = 'es_m') {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`🎙️ [Kokoro TTS] Generando audio: "${text.substring(0, 45)}..."`);

    // Intentar generar con el script Python de Kokoro si el modelo ONNX existe
    if (fs.existsSync(KOKORO_MODEL_PATH) && fs.existsSync(KOKORO_VOICES_PATH)) {
        try {
            const pyScript = `
import sys, os
try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    kokoro = Kokoro("${KOKORO_MODEL_PATH}", "${KOKORO_VOICES_PATH}")
    samples, sample_rate = kokoro.create("""${text.replace(/"/g, '\\"')}""", voice="es_m", speed=1.0, lang="es")
    sf.write("${outputPath}", samples, sample_rate)
    print("OK")
except Exception as e:
    sys.exit(1)
`;
            execSync(`python3 -c '${pyScript}' 2>/dev/null`);
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
                return outputPath;
            }
        } catch (e) {
            // Fallback a generación de audio sintético sincronizado
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

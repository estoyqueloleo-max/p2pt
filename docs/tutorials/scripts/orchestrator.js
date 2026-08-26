#!/usr/bin/env node

/**
 * Pingo Video Tutorial Orchestrator
 * End-to-end automated video tutorial producer with Kokoro TTS voiceover and FFmpeg muxing.
 * 
 * Usage:
 *   node docs/tutorials/scripts/orchestrator.js --all
 *   node docs/tutorials/scripts/orchestrator.js --chapter 1
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { chapter1 } from './chapters/chapter_1.js';
import { chapter2 } from './chapters/chapter_2.js';
import { chapter3 } from './chapters/chapter_3.js';
import { chapter4 } from './chapters/chapter_4.js';
import { chapter5 } from './chapters/chapter_5.js';
import { generateSpeech, concatAudioSegments } from './tts.js';
import { muxVideoAudio } from './muxer.js';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DOCS_DIR = path.resolve(SCRIPT_DIR, '..');
const VIDEOS_DIR = path.join(DOCS_DIR, 'videos');
const AUDIO_DIR = path.join(DOCS_DIR, 'audio');
const FINAL_DIR = path.join(DOCS_DIR, 'final');

const ALL_CHAPTERS = [chapter1, chapter2, chapter3, chapter4, chapter5];

// Parse CLI arguments
const args = process.argv.slice(2);
let targetChapters = ALL_CHAPTERS;

if (args.includes('--chapter')) {
    const idx = parseInt(args[args.indexOf('--chapter') + 1], 10);
    if (idx >= 1 && idx <= ALL_CHAPTERS.length) {
        targetChapters = [ALL_CHAPTERS[idx - 1]];
    }
}

let selectedVoice = 'ef_dora';
if (args.includes('--voice')) {
    selectedVoice = args[args.indexOf('--voice') + 1];
}

async function run() {
    console.log(`\n======================================================`);
    console.log(`  🎬 Pingo Masterclass & Video Tutorial Orchestrator  `);
    console.log(`  🎙️ Voz Kokoro: ${selectedVoice}`);
    console.log(`======================================================\n`);

    mkdirSafe(VIDEOS_DIR);
    mkdirSafe(AUDIO_DIR);
    mkdirSafe(FINAL_DIR);

    for (const chapter of targetChapters) {
        console.log(`\n📺 Procesando: [${chapter.id}] ${chapter.title}`);
        console.log(`------------------------------------------------------`);

        // 1. Generar segmentos de locución con Kokoro TTS
        console.log(`\n🎙️ Paso 1: Generando locución con Kokoro TTS (${selectedVoice})...`);
        const segmentFiles = [];
        for (let i = 0; i < chapter.steps.length; i++) {
            const step = chapter.steps[i];
            const segPath = path.join(AUDIO_DIR, `${chapter.id}_step_${step.stepIndex}.wav`);
            await generateSpeech(step.voiceover, segPath, selectedVoice);
            if (fs.existsSync(segPath)) {
                segmentFiles.push(segPath);
            }
        }

        const unifiedAudio = path.join(AUDIO_DIR, `${chapter.id}_full.wav`);
        concatAudioSegments(segmentFiles, unifiedAudio);
        console.log(`✓ Locución completa generada en: ${unifiedAudio}`);

        // 2. Grabar vídeo de pantalla en Full HD con Playwright
        console.log(`\n🎥 Paso 2: Grabando sesión de pantalla con Playwright...`);
        // Limpiar vídeos anteriores en VIDEOS_DIR para aislar el nuevo clip
        cleanDir(VIDEOS_DIR);

        const testFilter = chapter.id.replace('chapter_', 'Episodio 0');
        try {
            execSync(`npx playwright test docs/tutorials/scripts/record_tutorials.spec.js -g "${testFilter}"`, {
                stdio: 'inherit'
            });
        } catch (e) {
            console.error(`⚠️ Playwright finalizó con avisos`);
        }

        // 3. Localizar el vídeo .webm generado
        const videoFiles = fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.webm'));
        if (videoFiles.length === 0) {
            console.error(`❌ No se encontró ningún archivo de vídeo .webm en ${VIDEOS_DIR}`);
            continue;
        }

        const rawVideoPath = path.join(VIDEOS_DIR, videoFiles[0]);
        console.log(`✓ Vídeo capturado: ${rawVideoPath}`);

        // 4. Montar y sincronizar con FFmpeg
        console.log(`\n🎞️ Paso 3: Muxing y masterización con FFmpeg...`);
        const finalOutputPath = path.join(FINAL_DIR, chapter.outputFilename);
        const result = muxVideoAudio(rawVideoPath, unifiedAudio, finalOutputPath);

        if (result) {
            console.log(`\n🎉 ¡Episodio completado con éxito!`);
            console.log(`📂 Archivo listo: ${finalOutputPath}`);
        }
    }

    // Concatenar todos los episodios en un único vídeo masterclass si se procesaron todos
    if (targetChapters.length === ALL_CHAPTERS.length) {
        console.log(`\n======================================================`);
        console.log(`  🎞️ Uniendo todos los episodios en la Masterclass Completa...`);
        console.log(`======================================================\n`);

        const masterclassOutput = path.join(FINAL_DIR, 'pingo_masterclass_completa.mp4');
        const concatListFile = path.join(FINAL_DIR, 'masterclass_concat_list.txt');

        const fileEntries = ALL_CHAPTERS
            .map(ch => path.join(FINAL_DIR, ch.outputFilename))
            .filter(fp => fs.existsSync(fp))
            .map(fp => `file '${path.resolve(fp)}'`)
            .join('\n');

        fs.writeFileSync(concatListFile, fileEntries);

        try {
            execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c copy "${masterclassOutput}" 2>/dev/null || ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c:v libx264 -c:a aac "${masterclassOutput}" 2>/dev/null`);
            if (fs.existsSync(masterclassOutput) && fs.statSync(masterclassOutput).size > 1000) {
                const sizeMb = (fs.statSync(masterclassOutput).size / 1024 / 1024).toFixed(2);
                console.log(`🏆 [Masterclass Completa] Generada con éxito: ${masterclassOutput} (${sizeMb} MB)`);
            }
        } catch (e) {
            console.error('Error al unir la masterclass:', e.message);
        }
    }

    console.log(`\n======================================================`);
    console.log(`  ✅ Proceso de producción finalizado. Archivos en docs/tutorials/final/`);
    console.log(`======================================================\n`);
}

function mkdirSafe(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        for (const file of fs.readdirSync(dir)) {
            fs.unlinkSync(path.join(dir, file));
        }
    }
}

run().catch(err => {
    console.error('Error fatal en el orquestador:', err);
    process.exit(1);
});

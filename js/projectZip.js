/**
 * PROJECT ZIP MANAGER (projectZip.js)
 * 
 * Handles exporting and importing Launchpad-Online projects as self-contained .zip archives.
 * An exported archive contains:
 * - project.json (and <id>.json) with project manifest, pages, and pad mapping
 * - samples/page-<X>/pad-<Y>.<ext> with all assigned audio samples
 */

import defaultJSZip from './vendor/jszip.js';
import { buildProjectExport, buildDraftFromProject, normalizeZipPath } from './projectCreatorModel.js';

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'];
const PRECOMPRESSED_EXTENSIONS = ['.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'];

function isAudioFile(fileName) {
    const lower = fileName.toLowerCase();
    return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Packs a Studio Creator draft into a single .zip Blob.
 * @param {object} draft - The current editor draft.
 * @param {Function} [JSZipConstructor] - Optional JSZip constructor override for tests.
 * @returns {Promise<{ blob: Blob, filename: string, exportData: object }>}
 */
export async function exportProjectToZip(draft, JSZipConstructor = defaultJSZip) {
    if (!JSZipConstructor) {
        throw new Error('JSZip library is not available');
    }

    const exportData = buildProjectExport(draft);
    const zip = new JSZipConstructor();

    const jsonString = JSON.stringify(exportData.project, null, 2);
    // Include both canonical project.json and <id>.json for backwards/tooling compatibility
    zip.file('project.json', jsonString);
    if (exportData.configFileName && exportData.configFileName !== 'project.json') {
        zip.file(exportData.configFileName, jsonString);
    }

    // Add all audio sample files with optimal compression
    for (const item of exportData.files) {
        const fileContent = (item.file && item.file.data) ? item.file.data : item.file;
        const lower = item.path.toLowerCase();
        const isPrecompressed = PRECOMPRESSED_EXTENSIONS.some(ext => lower.endsWith(ext));
        zip.file(item.path, fileContent, {
            compression: isPrecompressed ? 'STORE' : 'DEFLATE'
        });
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    return {
        blob,
        filename: `${exportData.id}.zip`,
        exportData
    };
}

/**
 * Reads a .zip file or Blob and reconstructs a Studio Creator draft.
 * @param {Blob|File|ArrayBuffer} zipInput - The zip archive file or blob.
 * @param {Function} [JSZipConstructor] - Optional JSZip constructor override for tests.
 * @returns {Promise<{ draft: object, projectData: object }>}
 */
export async function importProjectFromZip(zipInput, JSZipConstructor = defaultJSZip) {
    if (!JSZipConstructor) {
        throw new Error('JSZip library is not available');
    }

    const zip = await JSZipConstructor.loadAsync(zipInput);

    // 1. Locate the project JSON manifest
    let jsonEntry = zip.file('project.json');
    if (!jsonEntry) {
        // Find any *.json in root or subfolder that isn't a package/lock file
        const candidates = Object.keys(zip.files).filter(name => {
            const lower = name.toLowerCase();
            return lower.endsWith('.json') && !lower.includes('package') && !lower.includes('manifest');
        });
        if (candidates.length > 0) {
            jsonEntry = zip.file(candidates[0]);
        }
    }

    if (!jsonEntry) {
        throw new Error('No valid project.json manifest found in the zip archive');
    }

    const jsonText = await jsonEntry.async('text');
    let projectData = null;
    try {
        projectData = JSON.parse(jsonText);
    } catch (parseError) {
        throw new Error(`Failed to parse project JSON: ${parseError.message}`);
    }

    // 2. Extract all audio samples into a file map indexed by canonical normalized path
    const fileMap = new Map();
    for (const [relativePath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (!isAudioFile(relativePath)) continue;

        const blob = await entry.async('blob');
        const fileName = relativePath.split('/').pop();
        // Give the blob a name property so it acts like a File object in the browser
        let fileObj = blob;
        try {
            if (typeof File !== 'undefined') {
                fileObj = new File([blob], fileName, { type: blob.type || 'audio/wav' });
            } else {
                fileObj.name = fileName;
            }
        } catch (_) {
            fileObj.name = fileName;
        }

        fileMap.set(normalizeZipPath(relativePath), fileObj);
    }

    // 3. Build the draft using the model
    const draft = buildDraftFromProject(projectData, fileMap);

    return {
        draft,
        projectData
    };
}

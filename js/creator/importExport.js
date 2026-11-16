/**
 * IMPORT / EXPORT (creator/importExport.js)
 *
 * Exporting the draft as a project .zip and importing a .zip into the Studio.
 */

import { audioEngine } from '../audio.js';
import { mapWithConcurrency } from '../concurrency.js';
import { AUDIO_LOAD_CONCURRENCY, LAUNCHPAD_PADS } from '../constants.js';
import { getTranslation, translate } from '../i18n.js';
import { showNotification } from '../notifications.js';
import { assignPadStepSample, getPadSteps } from '../projectCreatorModel.js';
import { creatorSession } from '../projectCreatorState.js';
import { exportProjectToZip, importProjectFromZip } from '../projectZip.js';
import { listen, setProps } from './dom.js';
import { logger } from '../logger.js';

export async function exportProject() {
    const draft = creatorSession.getDraft();
    if (!draft) return false;
    setProps('creator-export', { disabled: true });

    try {
        const nameInput = document.getElementById('project-creator-name');
        if (nameInput) {
            creatorSession.setName(nameInput.value);
        }
        if (!draft.name || !draft.name.trim()) {
            showNotification(getTranslation('creator.errorName'), 'warning');
            return false;
        }

        const { blob, filename } = await exportProjectToZip(draft);

        // Download the self-contained .zip project file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        creatorSession.markSaved();
        showNotification(getTranslation('creator.exportSuccess'), 'success', 5000);
        return true;
    } catch (error) {
        logger.error('[Creator] Export error:', error);
        showNotification(translate('creator.errorExport', { error: error.message }), 'error', 6000);
        return false;
    } finally {
        setProps('creator-export', { disabled: false });
    }
}

/**
 * Decodes every sample of an imported draft, a few files at a time.
 * @param {object} draft - Imported draft (not yet opened).
 * @param {function(): boolean} isCurrent - False once the import is superseded.
 * @returns {Promise<boolean>} Whether the import is still current afterwards.
 */
async function decodeDraftSamples(draft, isCurrent) {
    const jobs = [];
    draft.pages.forEach(page => {
        for (let padIndex = 0; padIndex < LAUNCHPAD_PADS; padIndex++) {
            getPadSteps(page, padIndex).forEach((step, stepIndex) => {
                if (step.sample) jobs.push({ page, padIndex, stepIndex, file: step.sample });
            });
        }
    });

    const decode = (file) => audioEngine.decodeAudioFile(file);
    await mapWithConcurrency(jobs, AUDIO_LOAD_CONCURRENCY, async ({ page, padIndex, stepIndex, file }) => {
        if (isCurrent()) await assignPadStepSample(page, padIndex, stepIndex, file, decode);
    });
    return isCurrent();
}

function reportImportResult(draft, missingAssets) {
    showNotification(translate('creator.importSuccess', { name: draft.name }), 'success', 5000);
    if (missingAssets.length > 0) {
        showNotification(
            translate('creator.missingAssets', { count: missingAssets.length, files: missingAssets.join(', ') }),
            'warning',
            8000
        );
    }
}

/**
 * Imports a project .zip into the Studio, replacing the current draft.
 * A newer import, or closing the editor, silently cancels this one.
 * @param {File} file
 */
async function handleProjectZipFile(file) {
    if (!file) return;
    if (creatorSession.isDirty() && !window.confirm(getTranslation('creator.confirmOverwriteDraft'))) return;

    showNotification(getTranslation('creator.importing'), 'info', 3000);
    const importId = creatorSession.nextImportId();
    const isCurrent = () => creatorSession.isImportCurrent(importId);

    try {
        const { draft, missingAssets = [] } = await importProjectFromZip(file);
        if (!isCurrent() || !(await decodeDraftSamples(draft, isCurrent))) return;

        // The 'draft' change stops playback and renders the imported draft.
        creatorSession.open(draft);
        reportImportResult(draft, missingAssets);
    } catch (error) {
        if (!isCurrent()) return;
        logger.error('[Creator] Import error:', error);
        showNotification(translate('creator.errorImport', { error: error.message }), 'error', 6000);
    }
}

function isZipFile(file) {
    return Boolean(file) && (file.name.endsWith('.zip') || file.type.includes('zip'));
}

export function initImportExportListeners() {
    listen('creator-export', 'click', exportProject);

    const zipInput = document.getElementById('creator-project-zip-input');
    listen('creator-import-project', 'click', () => {
        zipInput?.click();
    });
    listen(zipInput, 'change', event => {
        handleProjectZipFile(event.target.files?.[0]);
        event.target.value = '';
    });

    // Dropping a project .zip on the inspector imports it.
    const inspectorEl = document.getElementById('project-inspector');
    ['dragenter', 'dragover'].forEach(eventName => {
        listen(inspectorEl, eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    listen(inspectorEl, 'drop', e => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer?.files?.[0];
        if (isZipFile(file)) handleProjectZipFile(file);
    });
}

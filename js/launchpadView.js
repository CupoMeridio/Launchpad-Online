/**
 * LAUNCHPAD VIEW CONTROLLER (launchpadView.js)
 * 
 * Manages virtual Launchpad physical layout rendering and dynamic switching
 * between Classic/MK2, Modern MK3/X, Launchpad Pro (2015), and Launchpad Pro MK3 representations.
 */

import { invalidatePadCache } from './webInterface.js';

export const LAUNCHPAD_MODELS = {
    AUTO: 'auto',
    CLASSIC: 'classic',
    MK3: 'mk3',
    PRO: 'pro',
    PRO_MK3: 'pro-mk3'
};

const STORAGE_KEY = 'launchpad_model_preference';

let currentPreference = LAUNCHPAD_MODELS.AUTO;
let detectedHardwareModel = null;
let currentRenderedModel = null;

const ROW_LETTERS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const CLASSIC_SIDE_LABELS = ['Volume', 'Pan', 'Send A', 'Send B', 'Stop', 'Mute', 'Solo', 'Record Arm'];

const PRO_TOP_LABELS = ['Up', 'Down', 'Left', 'Right', 'Session', 'Note', 'Device', 'User'];
const PRO_LEFT_LABELS = ['Shift', 'Click', 'Undo', 'Delete', 'Quantise', 'Duplicate', 'Double', 'Record'];
const PRO_BOTTOM_LABELS = ['Record Arm', 'Track Select', 'Mute', 'Solo', 'Volume', 'Pan', 'Sends', 'Stop Clip'];

// Launchpad Pro MK3 hardware layout specifications (from physical unit)
const PRO_MK3_TOP_BUTTONS = [
    { type: 'icon', dir: 'left', title: 'Left' },
    { type: 'icon', dir: 'right', title: 'Right' },
    { type: 'text', text: 'Session' },
    { type: 'text', text: 'Note' },
    { type: 'text', text: 'Chord' },
    { type: 'text', text: 'Custom' },
    { type: 'text', text: 'Sequencer' },
    { type: 'text', text: 'Projects', subtext: 'Save' }
];

const PRO_MK3_LEFT_BUTTONS = [
    { type: 'icon', dir: 'up', title: 'Up' },
    { type: 'icon', dir: 'down', title: 'Down' },
    { type: 'text', text: 'Clear' },
    { type: 'text', text: 'Duplicate', subtext: 'Double' },
    { type: 'text', text: 'Quantise', subtext: 'Record Quantise' },
    { type: 'text', text: 'Fixed Length' },
    { type: 'play', title: 'Play' },
    { type: 'record', title: 'Record', subtext: 'Capture MIDI' }
];

const PRO_MK3_SCENE_BUTTONS = [
    { label: 'Patterns' },
    { label: 'Steps' },
    { label: 'Patterns Settings' },
    { label: 'Velocity' },
    { label: 'Probability' },
    { label: 'Mutation' },
    { label: 'Micro-Step' },
    { label: 'Print to Clip' }
];

const PRO_MK3_BOTTOM_BUTTONS = [
    { text: 'Record Arm', subtext: 'Undo' },
    { text: 'Mute', subtext: 'Redo' },
    { text: 'Solo', subtext: 'Click' },
    { text: 'Volume', subtext: '•' },
    { text: 'Pan', subtext: '••' },
    { text: 'Sends', subtext: 'Tap' },
    { text: 'Device', subtext: 'Tempo' },
    { text: 'Stop Clip', subtext: 'Swing' }
];

/**
 * Shared helper to render an arrow SVG icon rotated to the given direction.
 * @param {'right' | 'left' | 'up' | 'down'} [dir='right']
 * @param {string} [className='mk3-icon']
 * @returns {string}
 */
export function renderArrowSvg(dir = 'right', className = 'mk3-icon') {
    let rot = '';
    if (dir === 'up') rot = ' style="transform: rotate(-90deg);"';
    else if (dir === 'down') rot = ' style="transform: rotate(90deg);"';
    else if (dir === 'left') rot = ' style="transform: rotate(180deg);"';
    return `<svg viewBox="0 0 24 24" class="${className}"${rot}><polygon fill="currentColor" points="7,5 19,12 7,19"/></svg>`;
}

/**
 * Shared helper to render a single row of 8 central Launchpad grid pads.
 * @param {number} r - Row index 0..7
 * @returns {string}
 */
export function renderPadRow(r) {
    const letter = ROW_LETTERS[r];
    let row = '';
    for (let c = 1; c <= 8; c++) {
        const index = r * 8 + (c - 1);
        row += `      <div id="${letter}${c}" class="grid-item" data-index="${index}"></div>\n`;
    }
    return row;
}

/**
 * Builds the Classic / MK2 layout HTML (10x10 with vintage silkscreens, triangles and round buttons).
 * @returns {string}
 */
export function buildClassicHtml() {
    let html = `
      <div class="grid-item-triangle"><img src="assets/icons/triangle.png" class="triangolo" alt="Up"></div>
      <div class="grid-item-triangle"><img style="transform: rotate(180deg);" src="assets/icons/triangle.png" class="triangolo" alt="Down"></div>
      <div class="grid-item-triangle"><img style="transform: rotate(270deg);" src="assets/icons/triangle.png" class="triangolo" alt="Left"></div>
      <div class="grid-item-triangle"><img style="transform: rotate(90deg);" src="assets/icons/triangle.png" class="triangolo" alt="Right"></div>
      <div class="testo_su_launchpad">Session</div>
      <div class="testo_su_launchpad">User 1</div>
      <div class="testo_su_launchpad">User 2</div>
      <div class="testo_su_launchpad">Mixer</div>
      <div id="image-container"><img src="assets/icons/Logo.png" alt="immagine" class="square-image"></div>

      <div id="a1" class="grid-item-menu"></div>
      <div id="a2" class="grid-item-menu"></div>
      <div id="a3" class="grid-item-menu"></div>
      <div id="a4" class="grid-item-menu"></div>
      <div id="a5" class="grid-item-menu" data-mode="4"></div>
      <div id="a6" class="grid-item-menu" data-mode="5"></div>
      <div id="a7" class="grid-item-menu" data-mode="6"></div>
      <div id="a8" class="grid-item-menu" data-mode="7"></div>
`;

    for (let r = 0; r < 8; r++) {
        html += renderPadRow(r);
        html += `      <div id="m${r + 1}" class="grid-item-menu" data-page="${r}"></div>\n`;
        html += `      <div class="testo_su_launchpad">${CLASSIC_SIDE_LABELS[r]}</div>\n`;
    }

    return html;
}

/**
 * Builds the Modern MK3 / Launchpad X layout HTML (9x9 with sleek squircles and vector icons).
 * @returns {string}
 */
export function buildMk3Html() {
    let html = `
      <!-- Top header row (8 control buttons + corner badge) -->
      <div id="a1" class="grid-item-menu" title="Up">${renderArrowSvg('up', 'mk3-icon')}</div>
      <div id="a2" class="grid-item-menu" title="Down">${renderArrowSvg('down', 'mk3-icon')}</div>
      <div id="a3" class="grid-item-menu" title="Left">${renderArrowSvg('left', 'mk3-icon')}</div>
      <div id="a4" class="grid-item-menu" title="Right">${renderArrowSvg('right', 'mk3-icon')}</div>
      <div id="a5" class="grid-item-menu"><span class="mk3-btn-text">Session</span></div>
      <div id="a6" class="grid-item-menu"><span class="mk3-btn-text">Drums</span></div>
      <div id="a7" class="grid-item-menu"><span class="mk3-btn-text">Keys</span></div>
      <div id="a8" class="grid-item-menu"><span class="mk3-btn-text">User</span></div>
      <div id="image-container"><img src="assets/icons/Logo.png" alt="Novation" class="mk3-logo-img"></div>
`;

    for (let r = 0; r < 8; r++) {
        html += renderPadRow(r);
        html += `      <div id="m${r + 1}" class="grid-item-menu" data-page="${r}" title="Scene ${r + 1}">${renderArrowSvg('right', 'mk3-icon')}</div>\n`;
    }

    return html;
}

/**
 * Builds the Launchpad Pro (2015) layout HTML (10x10 with 32 outer perimeter round control buttons).
 * @param {Object} [options]
 * @param {boolean} [options.isMk3=false]
 * @returns {string}
 */
export function buildProHtml({ isMk3 = false } = {}) {
    if (isMk3) {
        return buildProMk3Html();
    }
    const btnShapeClass = 'pro-round-btn';
    let html = `
      <!-- Row 1: Top-left corner + 8 top buttons + top-right logo -->
      <div class="pro-corner-button pro-corner-top-left ${btnShapeClass}"></div>
`;

    // 8 Top buttons (a1..a8: Up, Down, Left, Right arrows + Session, Note, Device, User)
    for (let i = 0; i < 8; i++) {
        let topContent = '';
        if (i === 0) {
            topContent = renderArrowSvg('up', 'pro-icon');
        } else if (i === 1) {
            topContent = renderArrowSvg('down', 'pro-icon');
        } else if (i === 2) {
            topContent = renderArrowSvg('left', 'pro-icon');
        } else if (i === 3) {
            topContent = renderArrowSvg('right', 'pro-icon');
        } else {
            topContent = `<span class="pro-btn-text">${PRO_TOP_LABELS[i]}</span>`;
        }
        html += `      <div id="a${i + 1}" class="grid-item-menu ${btnShapeClass}" title="${PRO_TOP_LABELS[i]}">${topContent}</div>\n`;
    }
    html += `      <div class="pro-corner-button pro-corner-top-right ${btnShapeClass}" id="image-container"><img src="assets/icons/Logo.png" alt="Logo" class="pro-logo-img"></div>\n`;

    // Rows 2..9: Left button + 8 central pads + Right scene button
    for (let r = 0; r < 8; r++) {
        html += `      <div class="grid-item-pro-aux grid-item-pro-left ${btnShapeClass}"><span class="pro-btn-text">${PRO_LEFT_LABELS[r]}</span></div>\n`;
        html += renderPadRow(r);
        html += `      <div id="m${r + 1}" class="grid-item-menu ${btnShapeClass}" data-page="${r}" title="Scene ${r + 1}">${renderArrowSvg('right', 'pro-icon')}</div>\n`;
    }

    // Row 10: Bottom-left corner + 8 bottom buttons + bottom-right corner
    html += `      <div class="pro-corner-button pro-corner-bottom-left ${btnShapeClass}"></div>\n`;
    for (let b = 0; b < 8; b++) {
        html += `      <div class="grid-item-pro-aux grid-item-pro-bottom ${btnShapeClass}"><span class="pro-btn-text">${PRO_BOTTOM_LABELS[b]}</span></div>\n`;
    }
    html += `      <div class="pro-corner-button pro-corner-bottom-right ${btnShapeClass}"></div>\n`;

    return html;
}

/**
 * Builds the Launchpad Pro MK3 (2020) layout HTML (10x10 with squircle buttons).
 * Accurately models the physical hardware.
 * @returns {string}
 */
export function buildProMk3Html() {
    let html = `
      <!-- Row 1: Top-left Shift corner + 8 top buttons + top-right logo -->
      <div class="grid-item-pro-aux pro-corner-button pro-corner-top-left pro-squircle-btn" title="Shift"><span class="pro-btn-text">Shift</span></div>
`;

    // 8 Top buttons (a1..a8)
    for (let i = 0; i < 8; i++) {
        const item = PRO_MK3_TOP_BUTTONS[i];
        let content = '';
        if (item.type === 'icon') {
            content = renderArrowSvg(item.dir, 'pro-icon');
        } else if (item.subtext) {
            content = `<span class="pro-btn-text">${item.text}</span><span class="pro-subtext">${item.subtext}</span>`;
        } else {
            content = `<span class="pro-btn-text">${item.text}</span>`;
        }
        const title = item.subtext ? `${item.text} (${item.subtext})` : (item.title || item.text);
        html += `      <div id="a${i + 1}" class="grid-item-menu pro-squircle-btn" title="${title}">${content}</div>\n`;
    }
    html += `      <div class="pro-corner-button pro-corner-top-right pro-squircle-btn" id="image-container"><img src="assets/icons/Logo.png" alt="Logo" class="pro-logo-img"></div>\n`;

    // Rows 2..9: Left button + 8 central pads + Right scene button
    for (let r = 0; r < 8; r++) {
        const leftItem = PRO_MK3_LEFT_BUTTONS[r];
        let leftContent = '';
        if (leftItem.type === 'icon') {
            leftContent = renderArrowSvg(leftItem.dir, 'pro-icon');
        } else if (leftItem.type === 'play') {
            leftContent = `<svg viewBox="0 0 24 24" class="pro-icon"><polygon fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="8,6 18,12 8,18"/></svg>`;
        } else if (leftItem.type === 'record') {
            leftContent = `<svg viewBox="0 0 24 24" class="pro-icon pro-icon-record"><circle cx="12" cy="12" r="5.5" fill="none" stroke="#ff453a" stroke-width="2"/></svg><span class="pro-subtext pro-subtext-red">${leftItem.subtext}</span>`;
        } else if (leftItem.subtext) {
            leftContent = `<span class="pro-btn-text">${leftItem.text}</span><span class="pro-subtext">${leftItem.subtext}</span>`;
        } else {
            leftContent = `<span class="pro-btn-text">${leftItem.text}</span>`;
        }
        const leftTitle = leftItem.subtext ? `${leftItem.text} (${leftItem.subtext})` : (leftItem.title || leftItem.text);
        html += `      <div class="grid-item-pro-aux grid-item-pro-left pro-squircle-btn" title="${leftTitle}">${leftContent}</div>\n`;

        // 8 central pads
        html += renderPadRow(r);

        // Right scene button
        const sceneItem = PRO_MK3_SCENE_BUTTONS[r];
        html += `      <div id="m${r + 1}" class="grid-item-menu pro-squircle-btn" data-page="${r}" title="Scene ${r + 1} (${sceneItem.label})"><span class="pro-scene-arrow">&gt;</span><span class="pro-subtext">${sceneItem.label}</span></div>\n`;
    }

    // Row 10: Bottom-left Setup corner + 8 split column slots + bottom-right blank corner
    html += `      <div class="grid-item-pro-aux pro-corner-button pro-corner-bottom-left pro-squircle-btn" title="Setup"><span class="pro-btn-text">Setup</span></div>\n`;
    for (let b = 0; b < 8; b++) {
        const bottomItem = PRO_MK3_BOTTOM_BUTTONS[b];
        const isDots = bottomItem.subtext === '•' || bottomItem.subtext === '••';
        const subtextClass = isDots ? 'pro-subtext pro-subtext-dots' : 'pro-subtext';
        html += `      <div class="pro-split-column">\n`;
        html += `        <div class="grid-item-pro-aux pro-split-top pro-squircle-btn" title="Track ${b + 1}"></div>\n`;
        html += `        <div class="grid-item-pro-aux grid-item-pro-bottom pro-split-bottom pro-squircle-btn" title="${bottomItem.text} (${bottomItem.subtext})"><span class="pro-btn-text">${bottomItem.text}</span><span class="${subtextClass}">${bottomItem.subtext}</span></div>\n`;
        html += `      </div>\n`;
    }
    html += `      <div class="pro-corner-button pro-corner-bottom-right pro-squircle-btn"></div>\n`;

    return html;
}

/**
 * Returns the effective model to display based on user preference and detected hardware.
 * @returns {'classic' | 'mk3' | 'pro' | 'pro-mk3'}
 */
export function getEffectiveModel() {
    if (currentPreference !== LAUNCHPAD_MODELS.AUTO) {
        return currentPreference;
    }
    return detectedHardwareModel || LAUNCHPAD_MODELS.CLASSIC;
}

/**
 * Updates model preference and triggers re-render if necessary.
 * @param {'auto' | 'classic' | 'mk3' | 'pro' | 'pro-mk3'} preference
 */
export function setModelPreference(preference) {
    if (!Object.values(LAUNCHPAD_MODELS).includes(preference)) {
        console.warn(`[LaunchpadView] Unknown model preference: ${preference}`);
        return;
    }
    currentPreference = preference;
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) {
        // localStorage may fail in restricted/private contexts
    }
    const effective = getEffectiveModel();
    if (effective !== currentRenderedModel) {
        renderLaunchpad(effective);
    }
    syncModelSelectUI();
}

/**
 * Informs the view of hardware device detection from MIDI subsystem.
 * @param {'classic' | 'mk3' | 'pro' | 'pro-mk3' | null} hardwareModel
 */
export function setDetectedHardwareModel(hardwareModel) {
    detectedHardwareModel = hardwareModel;
    if (currentPreference === LAUNCHPAD_MODELS.AUTO) {
        const effective = getEffectiveModel();
        if (effective !== currentRenderedModel) {
            renderLaunchpad(effective);
        }
    }
}

/**
 * Renders the chosen model layout into the #Launchpad container.
 * Avoids redundant redraws if the requested model is already displayed.
 * @param {'classic' | 'mk3' | 'pro' | 'pro-mk3'} model
 */
export function renderLaunchpad(model) {
    const launchpad = document.getElementById('Launchpad');
    if (!launchpad) return;

    if (currentRenderedModel === model) {
        return;
    }
    currentRenderedModel = model;

    let html = '';
    if (model === LAUNCHPAD_MODELS.MK3) {
        html = buildMk3Html();
    } else if (model === LAUNCHPAD_MODELS.PRO_MK3) {
        html = buildProMk3Html();
    } else if (model === LAUNCHPAD_MODELS.PRO) {
        html = buildProHtml({ isMk3: false });
    } else {
        html = buildClassicHtml();
    }

    // Update model CSS classes on container
    launchpad.classList.remove(
        'launchpad-model-classic',
        'launchpad-model-mk3',
        'launchpad-model-pro',
        'launchpad-model-pro-mk3'
    );
    launchpad.classList.add(`launchpad-model-${model}`);

    // Update inner DOM
    launchpad.innerHTML = html;

    // Invalidate cached pad references for audio and lights
    invalidatePadCache();

    // Dispatch event for any other system interested in layout updates
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('launchpad-view-changed', { detail: { model } }));
    }
    console.log(`[LaunchpadView] Rendered model: ${model}`);
}

/**
 * Keeps the sidebar <select id="launchpad-model-select"> in sync with current preference.
 */
function syncModelSelectUI() {
    const select = document.getElementById('launchpad-model-select');
    if (select && select.value !== currentPreference) {
        select.value = currentPreference;
    }
}

/**
 * Initializes the Launchpad View controller.
 */
export function initLaunchpadView() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && Object.values(LAUNCHPAD_MODELS).includes(saved)) {
            currentPreference = saved;
        }
    } catch (e) {
        currentPreference = LAUNCHPAD_MODELS.AUTO;
    }

    const effective = getEffectiveModel();
    renderLaunchpad(effective);
    syncModelSelectUI();
}

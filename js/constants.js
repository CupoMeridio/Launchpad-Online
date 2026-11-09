/**
 * APPLICATION CONSTANTS (constants.js)
 * 
 * Central location for all magic numbers and fixed values.
 * If the Launchpad grid changes (e.g., 8x8 → 16x16 in future),
 * update these constants in ONE place instead of searching the entire codebase.
 */

// ============================================================================
// LAUNCHPAD HARDWARE DIMENSIONS
// ============================================================================

/**
 * Grid dimensions (standard Novation Launchpad: 8x8)
 * - Main playable pad grid: 8 columns x 8 rows = 64 pads
 * - Scene/Page buttons are in column 8 (to the right)
 * - Automap/Mode buttons are in row 8 (at the top)
 */
export const LAUNCHPAD_COLS = 8;
export const LAUNCHPAD_ROWS = 8;
export const LAUNCHPAD_PADS = LAUNCHPAD_COLS * LAUNCHPAD_ROWS; // 64

/**
 * Coordinate constants for special button rows/columns
 * - Scene buttons (page selection) are at x=8, y=0-7
 * - Automap buttons (mode selection) are at y=8, x=0-7
 */
export const SCENE_BUTTONS_X = 8;
export const AUTOMAP_BUTTONS_Y = 8;

/**
 * Total number of scene/page buttons (one per row)
 */
export const TOTAL_PAGES = LAUNCHPAD_ROWS; // 8

/**
 * Total number of automap/mode buttons (one per column)
 * - 0-3: Navigation (Up, Down, Left, Right)
 * - 4-7: Modes (Session, User 1, User 2, Mixer)
 */
export const TOTAL_AUTOMAP_BUTTONS = 8;
export const FIRST_MODE_INDEX = 4;
export const TOTAL_MODES = 4; // 4-7 are official modes

/**
 * Maximum number of multisample steps per pad in sequential round-robin mode.
 */
export const MAX_PAD_STEPS = 16;
export const DEFAULT_PAD_STEP = 0;

// ============================================================================
// PROJECT ASSET LOADING TIMEOUTS
// ============================================================================

/**
 * Maximum time to wait for project loading before forcing ERROR state (milliseconds)
 * Prevents app deadlock if loading operation crashes mid-process
 */
export const PROJECT_LOADING_TIMEOUT_MS = 60000; // 60 seconds

// ============================================================================
// ANIMATION & VISUAL FEEDBACK TIMEOUTS
// ============================================================================

/**
 * Duration of error shake animation on Launchpad when invalid action attempted
 */
export const ERROR_SHAKE_DURATION_MS = 500; // 500ms

// ============================================================================
// UI LAYOUT CONSTRAINTS
// ============================================================================

/**
 * Rotation range for Launchpad transform (degrees)
 */
export const LAUNCHPAD_ROTATION_MIN = 0;
export const LAUNCHPAD_ROTATION_MAX = 360;

/**
 * Size range for Launchpad scale (percentage)
 */
export const LAUNCHPAD_SIZE_MIN = 50; // 50% of original
export const LAUNCHPAD_SIZE_MAX = 140; // 140% of original

// ============================================================================
// PROJECT ASSET FILE TYPES
// ============================================================================
// Single source of truth for the file extensions understood by the project
// import/export logic and by the `accept` attributes of the upload inputs.

export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.mkv'];

/** Backgrounds and icons accept both images and videos. */
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

/** Every file type that may be packaged inside a project archive. */
export const PROJECT_ASSET_EXTENSIONS = [...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

/** Formats that already carry their own compression and are stored, not deflated. */
export const PRECOMPRESSED_EXTENSIONS = [
    '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
    '.mp4', '.mov', '.m4v', '.ogv', '.mkv'
];

/**
 * Builds the value for an `<input accept>` attribute from an extension list.
 * @param {string[]} extensions
 * @returns {string}
 */
export function toAcceptAttribute(extensions) {
    return [...new Set(extensions)].join(',');
}

/**
 * Checks whether a file name ends with one of the given extensions.
 * @param {string} fileName
 * @param {string[]} extensions
 * @returns {boolean}
 */
export function hasFileExtension(fileName, extensions) {
    if (typeof fileName !== 'string' || fileName.length === 0) return false;
    const lower = fileName.split('?')[0].split('#')[0].toLowerCase();
    return extensions.some(ext => lower.endsWith(ext));
}

// ============================================================================
// VISUALIZER OPTIONS
// ============================================================================

export const VISUALIZER_MODES = ['off', 'top', 'bottom', 'both', 'top-mirror', 'bottom-mirror', 'both-mirror'];
export const VISUALIZER_GRADIENT_DIRECTIONS = ['vertical', 'horizontal', 'vertical-reverse', 'horizontal-reverse'];

export const DEFAULT_VISUALIZER_MODE = 'off';
export const DEFAULT_VISUALIZER_COLOR = '#00aaff';
export const DEFAULT_VISUALIZER_GRADIENT = false;
export const DEFAULT_VISUALIZER_GRADIENT_DIRECTION = 'vertical';

// ============================================================================
// PROJECT LIGHT & PAGE CONSTRAINTS
// ============================================================================

export const MAX_PROJECT_PAGES = 8;
export const DEFAULT_LIGHT_DURATION_SEC = 2.5;
export const MIN_LIGHT_DURATION_SEC = 0.1;
export const MAX_LIGHT_DURATION_SEC = 60.0;

// Single source of truth for the LED palette: each color maps to the hardware
// tier it requires. 'legacy' colors work on every Launchpad, 'rgb' colors need
// an RGB-capable device (Mk2 / Pro / X / Mini Mk3).
export const ANIMATION_COLOR_TIERS = {
    red: 'legacy',
    orange: 'legacy',
    amber: 'legacy',
    yellow: 'legacy',
    green: 'legacy',
    blue: 'rgb',
    cyan: 'rgb',
    purple: 'rgb',
    pink: 'rgb',
    white: 'rgb'
};

// Palette order derives from the tier map, so the two never drift apart.
export const ANIMATION_COLORS = Object.keys(ANIMATION_COLOR_TIERS);

// Fallback swatch/ring color for a light whose LED colors cannot be resolved
// (e.g. an unknown or legacy animation name loaded from a project file).
export const DEFAULT_ANIMATION_SWATCH_COLOR = '#59bfe8';

export const TARGET_DEVICES = ['universal', 'legacy', 'rgb'];
export const DEFAULT_TARGET_DEVICE = 'universal';

/**
 * Validates and normalizes the target hardware declared by a project.
 * Falls back to 'universal' whenever the value is absent or unrecognized.
 * @param {string|null} [targetDevice]
 * @returns {'universal' | 'legacy' | 'rgb'}
 */
export function normalizeTargetDevice(targetDevice) {
    return (typeof targetDevice === 'string' && TARGET_DEVICES.includes(targetDevice))
        ? targetDevice
        : DEFAULT_TARGET_DEVICE;
}

/**
 * Extracts the color suffix from an animation name (e.g. 'fade_blue' -> 'blue').
 * @param {string|null} animationName
 * @returns {string|null}
 */
export function getColorFromAnimationName(animationName) {
    if (typeof animationName !== 'string' || !animationName) return null;
    return ANIMATION_COLORS.find(color => animationName.endsWith(`_${color}`)) || null;
}

// Fallback substitutions for colors not physically available on bi-color LEDs (Legacy Launchpad)
export const LEGACY_COLOR_FALLBACKS = {
    blue: 'green',
    cyan: 'green',
    purple: 'red',
    pink: 'red',
    white: 'amber'
};

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

// ============================================================================
// PROJECT ASSET LOADING TIMEOUTS
// ============================================================================

/**
 * Maximum time to wait for project loading before forcing ERROR state (milliseconds)
 * Prevents app deadlock if loading operation crashes mid-process
 */
export const PROJECT_LOADING_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Maximum time to wait for project ready state when MIDI device connects (milliseconds)
 * Allows some time for project to load, but doesn't block MIDI connection indefinitely
 */
export const MIDI_PROJECT_WAIT_TIMEOUT_MS = 3000; // 3 seconds

// ============================================================================
// ANIMATION & VISUAL FEEDBACK TIMEOUTS
// ============================================================================

/**
 * Duration of error shake animation on Launchpad when invalid action attempted
 */
export const ERROR_SHAKE_DURATION_MS = 500; // 500ms

/**
 * Duration for visualizer mode change animations
 */
export const VISUALIZER_TRANSITION_DURATION_MS = 300; // 300ms

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

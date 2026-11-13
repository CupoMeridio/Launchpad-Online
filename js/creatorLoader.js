/**
 * STUDIO CREATOR LOADER (creatorLoader.js)
 *
 * Lazily loads the Studio Creator module and its stylesheet on first use, so
 * the performance view does not pay for the editor at startup.
 */

const CREATOR_STYLESHEET_ID = 'creator-stylesheet';
const CREATOR_STYLESHEET_HREF = 'css/creator.css';

let stylesPromise = null;
let modulePromise = null;

/**
 * Injects css/creator.css once. Resolves even if the stylesheet fails, so a
 * styling problem never blocks the editor from opening.
 * @returns {Promise<void>}
 */
function loadCreatorStyles() {
    if (!stylesPromise) {
        if (document.getElementById(CREATOR_STYLESHEET_ID)) {
            stylesPromise = Promise.resolve();
        } else {
            stylesPromise = new Promise((resolve) => {
                const link = document.createElement('link');
                link.id = CREATOR_STYLESHEET_ID;
                link.rel = 'stylesheet';
                link.href = CREATOR_STYLESHEET_HREF;
                link.onload = () => resolve();
                link.onerror = () => resolve();
                document.head.appendChild(link);
            });
        }
    }
    return stylesPromise;
}

/**
 * Loads and initializes the Studio Creator (once). A failed load is retried on
 * the next call.
 * @returns {Promise<typeof import('./creator/index.js')>}
 */
export function loadProjectCreator() {
    if (!modulePromise) {
        modulePromise = Promise.all([
            import('./creator/index.js'),
            loadCreatorStyles()
        ]).then(([module]) => {
            module.initializeProjectCreator();
            return module;
        }).catch(error => {
            modulePromise = null;
            throw error;
        });
    }
    return modulePromise;
}

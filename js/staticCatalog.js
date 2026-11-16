/**
 * STATIC CATALOG (staticCatalog.js)
 *
 * Loads the built-in catalog (projects, background videos, skins) from
 * js/static-data.json once and shares it, so consumers such as the Studio
 * Creator never issue a second request.
 */

const CATALOG_URL = 'js/static-data.json';
const EMPTY_CATALOG = Object.freeze({ projects: [], videos: [], skins: [] });

/** @type {Promise<object>|null} */
let catalogPromise = null;
/** @type {object|null} */
let catalog = null;

/**
 * Fetches the catalog (once). Concurrent and later calls share the same request.
 * On failure the promise rejects and the next call retries.
 * @returns {Promise<{projects: object[], videos: string[], skins: string[]}>}
 */
export function loadStaticCatalog() {
    if (!catalogPromise) {
        catalogPromise = fetch(CATALOG_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                return response.json();
            })
            .then(data => {
                catalog = data;
                return data;
            })
            .catch(error => {
                catalogPromise = null;
                throw error;
            });
    }
    return catalogPromise;
}

/**
 * @returns {{projects: object[], videos: string[], skins: string[]}} The loaded
 *   catalog, or an empty one if it has not been (successfully) loaded yet.
 */
export function getStaticCatalog() {
    return catalog || EMPTY_CATALOG;
}

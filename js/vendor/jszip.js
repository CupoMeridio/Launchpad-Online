// ESM wrapper for vendored JSZip
let JSZipInstance = (typeof window !== 'undefined' && window.JSZip)
    || (typeof self !== 'undefined' && self.JSZip)
    || (typeof globalThis !== 'undefined' && globalThis.JSZip);

if (!JSZipInstance) {
    if (typeof window === 'undefined') {
        // Node.js environment (e.g. running unit tests)
        const jszipNode = await import('jszip');
        JSZipInstance = jszipNode.default || jszipNode;
    } else {
        // Browser environment
        await import('./jszip.min.js');
        JSZipInstance = window.JSZip || self.JSZip || globalThis.JSZip;
    }
}

export default JSZipInstance;

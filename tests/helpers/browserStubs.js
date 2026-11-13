/**
 * Minimal browser stubs for integration tests that drive real app modules
 * under Node: a small element model (classes, dataset, attributes, events,
 * `closest`), a document with an id registry, and a window that records
 * dispatched events. Only what the app actually uses is implemented.
 */

const LAUNCHPAD_PADS = 64;

function selectorMatches(element, selector) {
    // Supports '.class', '#id' and compound '.a.b'.
    const parts = selector.trim().match(/[.#][\w-]+/g) || [];
    return parts.length > 0 && parts.every(part => (
        part.startsWith('#') ? element.id === part.slice(1) : element.classList.contains(part.slice(1))
    ));
}

export function createElement(tagName = 'div', { id = '', className = '', dataset = {} } = {}) {
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    const attributes = new Map();
    const listeners = new Map();

    const element = {
        tagName: tagName.toUpperCase(),
        id,
        parentElement: null,
        children: [],
        dataset: { ...dataset },
        hidden: false,
        disabled: false,
        value: '',
        textContent: '',
        classList: {
            add: (...names) => names.forEach(n => classes.add(n)),
            remove: (...names) => names.forEach(n => classes.delete(n)),
            contains: name => classes.has(name),
            toggle(name, force) {
                const on = force === undefined ? !classes.has(name) : Boolean(force);
                if (on) classes.add(name); else classes.delete(name);
                return on;
            },
            [Symbol.iterator]: () => classes[Symbol.iterator]()
        },
        style: {
            setProperty(name, value) { this[name] = value; },
            removeProperty(name) { delete this[name]; }
        },
        setAttribute: (name, value) => attributes.set(name, String(value)),
        getAttribute: name => (attributes.has(name) ? attributes.get(name) : null),
        removeAttribute: name => attributes.delete(name),
        appendChild(child) {
            child.parentElement = element;
            element.children.push(child);
            return child;
        },
        remove() {
            const parent = element.parentElement;
            if (!parent) return;
            parent.children = parent.children.filter(child => child !== element);
            element.parentElement = null;
        },
        replaceChildren(...children) {
            element.children = [];
            children.forEach(child => element.appendChild(child));
        },
        contains(other) {
            for (let node = other; node; node = node.parentElement) {
                if (node === element) return true;
            }
            return false;
        },
        closest(selector) {
            const alternatives = selector.split(',');
            for (let node = element; node; node = node.parentElement) {
                if (alternatives.some(alt => selectorMatches(node, alt))) return node;
            }
            return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            listeners.get(type)?.delete(handler);
        },
        /** Dispatches an event that bubbles to the ancestors (like the DOM). */
        dispatch(type, init = {}) {
            const event = {
                type,
                target: element,
                defaultPrevented: false,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() {},
                ...init
            };
            for (let node = element; node; node = node.parentElement) {
                node.fire(type, event);
            }
            return event;
        },
        fire(type, event) {
            // Like the DOM, `this` inside a listener is the element it was added to.
            listeners.get(type)?.forEach(handler => handler.call(element, event));
        }
    };

    // Like the DOM, `className` and `classList` are two views of the same classes.
    Object.defineProperty(element, 'className', {
        get: () => [...classes].join(' '),
        set(value) {
            classes.clear();
            String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
        }
    });

    // Media elements "load" asynchronously once a source is set, like a
    // successfully fetched image/video would.
    let src = '';
    Object.defineProperty(element, 'src', {
        get: () => src,
        set(value) {
            src = value;
            queueMicrotask(() => {
                element.onload?.();
                element.oncanplay?.();
            });
        }
    });
    return element;
}

/**
 * Builds a Launchpad: a container with 64 pads (`.grid-item[data-index]`),
 * 8 page buttons and the mode buttons, wired as children so events bubble.
 */
export function createLaunchpad() {
    const launchpad = createElement('div', { id: 'Launchpad' });
    const pads = Array.from({ length: LAUNCHPAD_PADS }, (_, index) =>
        launchpad.appendChild(createElement('div', { className: 'grid-item', dataset: { index: String(index) } }))
    );
    const pageButtons = Array.from({ length: 8 }, (_, page) =>
        launchpad.appendChild(createElement('div', { className: 'grid-item-menu', dataset: { page: String(page) } }))
    );
    const modeButtons = Array.from({ length: 8 }, (_, mode) =>
        launchpad.appendChild(createElement('div', { className: 'grid-item-menu', dataset: { mode: String(mode) } }))
    );
    return { launchpad, pads, pageButtons, modeButtons };
}

/**
 * Installs `document`, `window` and related globals.
 * @returns {{ elements: Map<string, object>, windowEvents: object[], launchpad: ReturnType<typeof createLaunchpad> }}
 */
export function installBrowserStubs() {
    const elements = new Map();
    const windowEvents = [];
    const windowListeners = new Map();
    const launchpad = createLaunchpad();
    elements.set('Launchpad', launchpad.launchpad);

    const getElementById = (id) => {
        if (!elements.has(id)) elements.set(id, createElement('div', { id }));
        return elements.get(id);
    };

    globalThis.window = {
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, new Set());
            windowListeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            windowListeners.get(type)?.delete(handler);
        },
        dispatchEvent(event) {
            windowEvents.push(event);
            windowListeners.get(event.type)?.forEach(handler => handler(event));
            return true;
        },
        setTimeout: (...args) => setTimeout(...args),
        clearTimeout: (...args) => clearTimeout(...args)
    };
    globalThis.document = {
        visibilityState: 'visible',
        readyState: 'complete',
        documentElement: createElement('html'),
        head: createElement('head'),
        body: createElement('body'),
        addEventListener() {},
        getElementById,
        createElement: (tag) => createElement(tag),
        createDocumentFragment: () => createElement('fragment'),
        querySelector(selector) {
            if (selector.startsWith('#')) return getElementById(selector.slice(1));
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.grid-item') return launchpad.pads;
            if (selector.includes('[data-page]')) return launchpad.pageButtons;
            if (selector.includes('[data-mode]')) return launchpad.modeButtons;
            return [];
        }
    };
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    };
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.CSS = { escape: value => String(value) };

    return { elements, windowEvents, launchpad };
}

/** Logger sink that records instead of printing. */
export function createRecordingSink() {
    const entries = [];
    return {
        entries,
        log: (...args) => entries.push(['log', ...args]),
        warn: (...args) => entries.push(['warn', ...args]),
        error: (...args) => entries.push(['error', ...args])
    };
}

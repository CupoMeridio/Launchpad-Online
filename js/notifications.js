/**
 * NOTIFICATIONS (notifications.js)
 *
 * Transient on-screen toasts. Leaf module with no app dependencies, so engine
 * modules (audio, MIDI, project loading) can report to the user without
 * importing the UI layer.
 */

/**
 * Notification types. Each one is styled by a `.notification.<type>` rule in
 * css/style.css (enforced by tests/cssDomParity.test.js).
 */
export const NOTIFICATION_TYPES = Object.freeze(['info', 'success', 'warning', 'error']);

/** Duration of the CSS fade-out (`.notification` opacity transition). */
const FADE_OUT_MS = 500;
/** Extra time before force-removing a toast whose `transitionend` never fired. */
const REMOVAL_GRACE_MS = 100;

/**
 * Shows a temporary notification on the screen.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Unknown types fall back to 'info'.
 * @param {number} [duration=3000] - Milliseconds before it starts fading out.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${NOTIFICATION_TYPES.includes(type) ? type : 'info'}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Trigger the fade-in
    setTimeout(() => notification.classList.add('show'), 10);

    // Fade out, then remove. The fallback timer covers cases where
    // `transitionend` never fires (background tabs, reduced motion).
    setTimeout(() => {
        notification.classList.remove('show');
        const remove = () => notification.remove();
        notification.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, FADE_OUT_MS + REMOVAL_GRACE_MS);
    }, duration);
}

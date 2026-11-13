/**
 * NOTIFICATIONS (notifications.js)
 *
 * Transient on-screen toasts. Leaf module with no app dependencies, so engine
 * modules (audio, MIDI, project loading) can report to the user without
 * importing the UI layer.
 */

/**
 * Shows a temporary notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} type - The type of notification ('success', 'error', 'info').
 * @param {number} duration - Duration in milliseconds before it disappears.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove notification after duration
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove());
    }, duration);
}

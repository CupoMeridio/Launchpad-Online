/**
 * FORM CONTROLS MODULE (formControls.js)
 * 
 * Centralizes reusable form control patterns like synchronized
 * slider + number input pairs.
 */

export function syncInputSlider(sliderId, inputId, callback, min, max, isFloat = false) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    if (!slider || !input) return;

    const updateValue = (val, source) => {
        let value = isFloat ? parseFloat(val) : parseInt(val, 10);

        if (isNaN(value)) return;

        const clampedValue = Math.max(min, Math.min(max, value));

        if (source === 'slider') {
            input.value = String(clampedValue);
            callback(clampedValue);
        } else if (source === 'input') {
            if (value >= min && value <= max) {
                slider.value = String(value);
                callback(value);
            }
        }
    };

    slider.addEventListener('input', function () {
        updateValue(this.value, 'slider');
    });

    input.addEventListener('input', function () {
        updateValue(this.value, 'input');
    });

    input.addEventListener('blur', function () {
        let value = isFloat ? parseFloat(this.value) : parseInt(this.value, 10);
        if (isNaN(value)) value = min;
        const clampedValue = Math.max(min, Math.min(max, value));
        this.value = String(clampedValue);
        slider.value = String(clampedValue);
        callback(clampedValue);
    });
}
import { updateVideoControlsVisibility } from './video.js';
const translations = {
    it: {
        'sidebar.title': 'Menu',
        'menu.language.toggle': 'Lingua interfaccia',
        'menu.language.label': 'Seleziona lingua',
        'menu.language.option.it': 'Italiano',
        'menu.language.option.en': 'English',
        'menu.language.option.es': 'Español',
        'menu.language.option.de': 'Deutsch',
        'menu.language.option.fr': 'Français',
        'menu.project.toggle': 'Seleziona progetto',
        'menu.background.toggle': 'Sfondo',
        'menu.visualizer.toggle': 'Visualizzatore',
        'menu.launchpad.toggle': 'Personalizza Launchpad',
        'background.none': 'Nessuno sfondo',
        'background.opacity': 'Opacità del livello',
        'background.blur': 'Sfocatura',
        'background.brightness': 'Luminosità',
        'background.upload': 'Carica file',
        'visualizer.mode.both': 'Entrambi i pannelli',
        'visualizer.mode.top': 'Solo superiore',
        'visualizer.mode.bottom': 'Solo inferiore',
        'visualizer.mode.off': 'Disattivato',
        'visualizer.symmetric': 'Simmetrico',
        'visualizer.smoothing': 'Fluidità animazione',
        'visualizer.color1': 'Colore iniziale',
        'visualizer.color2': 'Colore finale',
        'visualizer.gradient.enable': 'Abilita gradiente di colore',
        'visualizer.gradient.direction': 'Direzione del gradiente',
        'visualizer.gradient.vertical': 'Verticale',
        'visualizer.gradient.horizontal': 'Orizzontale',
        'visualizer.gradient.verticalReverse': 'Verticale (inverso)',
        'visualizer.gradient.horizontalReverse': 'Orizzontale (inverso)',
        'visualizer.alpha': 'Trasparenza',
        'visualizer.symmetricReverse': 'Inverti riflessione',
        'launchpad.stickers.show': 'Mostra adesivi sul Launchpad',
        'launchpad.default': 'Predefinito',
        'overlay.clickToStart': 'Clicca per avviare',
        'midi.status.connected': 'Launchpad collegato',
        'midi.status.disconnected': 'Launchpad scollegato',
        'midi.notSupported': 'MIDI non supportato',
        'launchpad.rotation': 'Rotazione Launchpad',
        'launchpad.icon.label': 'Icona in alto a destra',
        'launchpad.icon.upload': 'Carica icona/video',
        'launchpad.icon.reset': 'Ripristina icona',
        'visualizer.symmetricMode': 'Modalità',
        'visualizer.symmetric.normal': 'Normale',
        'visualizer.symmetric.reverse': 'Inversa',
        'launchpad.skins.title': 'Sfondi Launchpad'
    },
    en: {
        'sidebar.title': 'Menu',
        'menu.language.toggle': 'Interface Language',
        'menu.language.label': 'Select language',
        'menu.language.option.it': 'Italian',
        'menu.language.option.en': 'English',
        'menu.language.option.es': 'Spanish',
        'menu.language.option.de': 'German',
        'menu.language.option.fr': 'French',
        'menu.project.toggle': 'Select Project',
        'menu.background.toggle': 'Background',
        'menu.visualizer.toggle': 'Visualizer',
        'menu.launchpad.toggle': 'Personalize Launchpad',
        'background.none': 'No Background',
        'background.opacity': 'Overlay opacity',
        'background.blur': 'Blur',
        'background.brightness': 'Brightness',
        'background.upload': 'Upload file',
        'visualizer.mode.both': 'Both Panels',
        'visualizer.mode.top': 'Top Only',
        'visualizer.mode.bottom': 'Bottom Only',
        'visualizer.mode.off': 'Off',
        'visualizer.symmetric': 'Symmetric',
        'visualizer.smoothing': 'Animation smoothness',
        'visualizer.color1': 'Start color',
        'visualizer.color2': 'End color',
        'visualizer.gradient.enable': 'Enable color gradient',
        'visualizer.gradient.direction': 'Gradient direction',
        'visualizer.gradient.vertical': 'Vertical',
        'visualizer.gradient.horizontal': 'Horizontal',
        'visualizer.gradient.verticalReverse': 'Vertical (reverse)',
        'visualizer.gradient.horizontalReverse': 'Horizontal (reverse)',
        'visualizer.alpha': 'Transparency',
        'visualizer.symmetricReverse': 'Reverse reflection',
        'launchpad.stickers.show': 'Show stickers on Launchpad',
        'launchpad.default': 'Default',
        'overlay.clickToStart': 'Click to start',
        'midi.status.connected': 'Launchpad Connected',
        'midi.status.disconnected': 'Launchpad Disconnected',
        'midi.notSupported': 'MIDI Not Supported',
        'launchpad.rotation': 'Launchpad rotation',
        'launchpad.icon.label': 'Top-right icon',
        'launchpad.icon.upload': 'Upload icon/video',
        'launchpad.icon.reset': 'Reset icon',
        'visualizer.symmetricMode': 'Mode',
        'visualizer.symmetric.normal': 'Normal',
        'visualizer.symmetric.reverse': 'Reverse',
        'launchpad.skins.title': 'Launchpad Backgrounds'
    },
    es: {
        'sidebar.title': 'Menú',
        'menu.language.toggle': 'Idioma de la interfaz',
        'menu.language.label': 'Seleccionar idioma',
        'menu.language.option.it': 'Italiano',
        'menu.language.option.en': 'English',
        'menu.language.option.es': 'Español',
        'menu.language.option.de': 'Deutsch',
        'menu.language.option.fr': 'Français',
        'menu.project.toggle': 'Seleccionar proyecto',
        'menu.background.toggle': 'Fondo',
        'menu.visualizer.toggle': 'Visualizador',
        'menu.launchpad.toggle': 'Personalizar Launchpad',
        'background.none': 'Sin fondo',
        'background.opacity': 'Opacidad de la superposición',
        'background.blur': 'Desenfoque',
        'background.brightness': 'Brillo',
        'background.upload': 'Subir archivo',
        'visualizer.mode.both': 'Ambos paneles',
        'visualizer.mode.top': 'Solo superior',
        'visualizer.mode.bottom': 'Solo inferior',
        'visualizer.mode.off': 'Desactivado',
        'visualizer.symmetric': 'Simétrico',
        'visualizer.smoothing': 'Suavizado de animación',
        'visualizer.color1': 'Color inicial',
        'visualizer.color2': 'Color final',
        'visualizer.gradient.enable': 'Habilitar degradado',
        'visualizer.gradient.direction': 'Dirección del degradado',
        'visualizer.gradient.vertical': 'Vertical',
        'visualizer.gradient.horizontal': 'Horizontal',
        'visualizer.gradient.verticalReverse': 'Vertical (invertido)',
        'visualizer.gradient.horizontalReverse': 'Horizontal (invertido)',
        'visualizer.alpha': 'Transparencia',
        'visualizer.symmetricReverse': 'Reflexión inversa',
        'launchpad.stickers.show': 'Mostrar pegatinas en el Launchpad',
        'launchpad.default': 'Predeterminado',
        'overlay.clickToStart': 'Haz clic para iniciar',
        'midi.status.connected': 'Launchpad conectado',
        'midi.status.disconnected': 'Launchpad desconectado',
        'midi.notSupported': 'MIDI no soportado',
        'launchpad.rotation': 'Rotación del Launchpad',
        'launchpad.icon.label': 'Ícono arriba a la derecha',
        'launchpad.icon.upload': 'Subir ícono/video',
        'launchpad.icon.reset': 'Restablecer ícono',
        'visualizer.symmetricMode': 'Modo',
        'visualizer.symmetric.normal': 'Normal',
        'visualizer.symmetric.reverse': 'Inversa',
        'launchpad.skins.title': 'Fondos de Launchpad'
    },
    de: {
        'sidebar.title': 'Menü',
        'menu.language.toggle': 'Interface-Sprache',
        'menu.language.label': 'Sprache auswählen',
        'menu.language.option.it': 'Italienisch',
        'menu.language.option.en': 'Englisch',
        'menu.language.option.es': 'Spanisch',
        'menu.language.option.de': 'Deutsch',
        'menu.language.option.fr': 'Französisch',
        'menu.project.toggle': 'Projekt auswählen',
        'menu.background.toggle': 'Hintergrund',
        'menu.visualizer.toggle': 'Visualizer',
        'menu.launchpad.toggle': 'Launchpad anpassen',
        'background.none': 'Kein Hintergrund',
        'background.opacity': 'Deckkraft der Überlagerung',
        'background.blur': 'Unschärfe',
        'background.brightness': 'Helligkeit',
        'background.upload': 'Datei hochladen',
        'visualizer.mode.both': 'Beide Panels',
        'visualizer.mode.top': 'Nur oben',
        'visualizer.mode.bottom': 'Nur unten',
        'visualizer.mode.off': 'Aus',
        'visualizer.symmetric': 'Symmetrisch',
        'visualizer.smoothing': 'Animationsglättung',
        'visualizer.color1': 'Startfarbe',
        'visualizer.color2': 'Endfarbe',
        'visualizer.gradient.enable': 'Farbverlauf aktivieren',
        'visualizer.gradient.direction': 'Verlaufsrichtung',
        'visualizer.gradient.vertical': 'Vertikal',
        'visualizer.gradient.horizontal': 'Horizontal',
        'visualizer.gradient.verticalReverse': 'Vertikal (invertiert)',
        'visualizer.gradient.horizontalReverse': 'Horizontal (invertiert)',
        'visualizer.alpha': 'Transparenz',
        'visualizer.symmetricReverse': 'Spiegelung invertieren',
        'launchpad.stickers.show': 'Sticker auf Launchpad anzeigen',
        'launchpad.default': 'Standard',
        'overlay.clickToStart': 'Klicken zum Starten',
        'midi.status.connected': 'Launchpad verbunden',
        'midi.status.disconnected': 'Launchpad getrennt',
        'midi.notSupported': 'MIDI nicht unterstützt',
        'launchpad.rotation': 'Launchpad-Drehung',
        'launchpad.icon.label': 'Icon oben rechts',
        'launchpad.icon.upload': 'Icon/Video hochladen',
        'launchpad.icon.reset': 'Icon zurücksetzen',
        'visualizer.symmetricMode': 'Modus',
        'visualizer.symmetric.normal': 'Normal',
        'visualizer.symmetric.reverse': 'Invertiert',
        'launchpad.skins.title': 'Launchpad-Hintergründe'
    },
    fr: {
        'sidebar.title': 'Menu',
        'menu.language.toggle': 'Langue de l’interface',
        'menu.language.label': 'Sélectionner la langue',
        'menu.language.option.it': 'Italien',
        'menu.language.option.en': 'Anglais',
        'menu.language.option.es': 'Espagnol',
        'menu.language.option.de': 'Allemand',
        'menu.language.option.fr': 'Français',
        'menu.project.toggle': 'Sélectionner le projet',
        'menu.background.toggle': 'Arrière-plan',
        'menu.visualizer.toggle': 'Visualiseur',
        'menu.launchpad.toggle': 'Personnaliser le Launchpad',
        'background.none': 'Aucun fond',
        'background.opacity': 'Opacité de la superposition',
        'background.blur': 'Flou',
        'background.brightness': 'Luminosité',
        'background.upload': 'Téléverser un fichier',
        'visualizer.mode.both': 'Deux panneaux',
        'visualizer.mode.top': 'Seulement supérieur',
        'visualizer.mode.bottom': 'Seulement inférieur',
        'visualizer.mode.off': 'Désactivé',
        'visualizer.symmetric': 'Symétrique',
        'visualizer.smoothing': 'Fluidité de l’animation',
        'visualizer.color1': 'Couleur de départ',
        'visualizer.color2': 'Couleur d’arrivée',
        'visualizer.gradient.enable': 'Activer le dégradé',
        'visualizer.gradient.direction': 'Direction du dégradé',
        'visualizer.gradient.vertical': 'Vertical',
        'visualizer.gradient.horizontal': 'Horizontal',
        'visualizer.gradient.verticalReverse': 'Vertical (inversé)',
        'visualizer.gradient.horizontalReverse': 'Horizontal (inversé)',
        'visualizer.alpha': 'Transparence',
        'visualizer.symmetricReverse': 'Inverser la réflexion',
        'launchpad.stickers.show': 'Afficher les autocollants sur le Launchpad',
        'launchpad.default': 'Par défaut',
        'overlay.clickToStart': 'Cliquez pour démarrer',
        'midi.status.connected': 'Launchpad connecté',
        'midi.status.disconnected': 'Launchpad déconnecté',
        'midi.notSupported': 'MIDI non pris en charge',
        'launchpad.rotation': 'Rotation du Launchpad',
        'launchpad.icon.label': 'Icône en haut à droite',
        'launchpad.icon.upload': 'Téléverser icône/vidéo',
        'launchpad.icon.reset': 'Réinitialiser l’icône',
        'visualizer.symmetricMode': 'Mode',
        'visualizer.symmetric.normal': 'Normal',
        'visualizer.symmetric.reverse': 'Inversée',
        'launchpad.skins.title': 'Arrière-plans Launchpad'
    }
};
let currentLanguage = 'it';

function applyTranslations() {
    const t = translations[currentLanguage] || translations.it;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t[key];
        if (typeof text === 'string') {
            el.textContent = text;
        }
    });
}

export function getTranslation(key) {
    const t = translations[currentLanguage] || translations.it;
    return t[key] || key;
}

export function initializeLanguageControls() {
    const select = document.getElementById('language-select');
    const saved = localStorage.getItem('ui.language');
    currentLanguage = saved || 'it';
    if (select) {
        select.value = currentLanguage;
        select.addEventListener('change', function() {
            currentLanguage = this.value;
            localStorage.setItem('ui.language', currentLanguage);
            applyTranslations();
        });
    }
    applyTranslations();
}

/**
 * Shows or hides the sidebar.
 */
export function toggleSidebar() {
    const layout = document.querySelector('.layout');
    layout.classList.toggle('sidebar-open');
}

/**
 * Opens or closes a dropdown menu in the sidebar.
 * @param {string} menuId - The ID of the menu element to toggle.
 */
export function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    const willOpen = !menu.classList.contains('open');
    if (willOpen) {
        document.querySelectorAll('.menu-dropdown.open').forEach(other => {
            if (other !== menu) {
                other.classList.remove('open');
                const otherItem = other.closest('.menu-item');
                const otherToggle = otherItem ? otherItem.querySelector('.menu-toggle') : null;
                if (otherToggle) otherToggle.classList.remove('active');
            }
        });
    }
    menu.classList.toggle('open');

    const menuItem = menu.closest('.menu-item');
    if (menuItem) {
        const toggleButton = menuItem.querySelector('.menu-toggle');
        if (toggleButton) {
            if (menu.classList.contains('open')) {
                toggleButton.classList.add('active');
            } else {
                toggleButton.classList.remove('active');
            }
        }
    }

    updateVideoControlsVisibility();
}

/**
 * Sets a background image for the Launchpad.
 * @param {string|null} imageFile - The image file name, or `null` to remove it.
 */
export function setLaunchpadBackground(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    const menu = document.getElementById('personalize-launchpad-menu');
    if (menu) {
        const buttons = menu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        const selector = imageFile ? `.menu-option[data-skin="${imageFile}"]` : '.menu-option[data-skin="none"]';
        const active = menu.querySelector(selector);
        if (active) active.classList.add('selected');
    }
    if (imageFile) {
        launchpad.style.backgroundImage = `url('/assets/images/launchpad covers/${imageFile}?t=${new Date().getTime()}')`;
    } else {
        launchpad.style.backgroundImage = 'none';
    }
}

/**
 * Shows or hides the pad "stickers".
 * @param {boolean} isActive - `true` to show stickers, `false` to hide them.
 */
export function toggleLaunchpadStickers(isActive) {
    const launchpad = document.getElementById('Launchpad');
    if (isActive) {
        launchpad.classList.add('has-stickers');
    } else {
        launchpad.classList.remove('has-stickers');
    }
}

/**
 * Dynamically populates the menu for customizing the Launchpad background.
 * @param {string[]} imageFiles - An array of image file names (skins).
 */
export function initializePersonalizeLaunchpadMenu(imageFiles) {
    const menu = document.getElementById('personalize-launchpad-menu');
    
    imageFiles.forEach(imageFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-skin', imageFile);
        button.textContent = imageFile.split('.')[0].replace(/_/g, ' ');
        button.onclick = () => setLaunchpadBackground(imageFile);
        menu.appendChild(button);
    });

    const rotationSlider = document.getElementById('rotation-slider');
    const rotationInput = document.getElementById('rotation-input');
    if (rotationSlider && rotationInput) {
        rotationSlider.value = '0';
        rotationInput.value = '0';
        rotationSlider.addEventListener('input', function() {
            rotationInput.value = this.value;
            setLaunchpadRotation(parseInt(this.value, 10));
        });
        rotationInput.addEventListener('input', function() {
            let value = parseInt(this.value, 10);
            if (isNaN(value)) return;
            value = Math.max(0, Math.min(360, value));
            this.value = String(value);
            rotationSlider.value = String(value);
            setLaunchpadRotation(value);
        });
    }

    const logoInput = document.getElementById('logo-file-input');
    const logoTrigger = document.getElementById('logo-file-trigger');
    if (logoTrigger && logoInput) {
        logoTrigger.addEventListener('click', function() {
            logoInput.value = '';
            logoInput.click();
        });
        logoInput.addEventListener('change', function() {
            const file = this.files && this.files[0];
            if (!file) return;
            setTopRightIconFile(file);
        });
    }
}

// Global exposure for usage in HTML
window.toggleSidebar = toggleSidebar;
window.toggleMenu = toggleMenu;
window.setLaunchpadBackground = setLaunchpadBackground;
window.toggleLaunchpadStickers = toggleLaunchpadStickers;
window.initializeLanguageControls = initializeLanguageControls;
export function setLaunchpadRotation(angle) {
    const launchpad = document.getElementById('Launchpad');
    if (launchpad) {
        launchpad.style.transform = `rotate(${angle}deg)`;
        const rotationSlider = document.getElementById('rotation-slider');
        const rotationInput = document.getElementById('rotation-input');
        if (rotationSlider && rotationInput) {
            rotationSlider.value = String(angle);
            rotationInput.value = String(angle);
        }
    }
}
window.setLaunchpadRotation = setLaunchpadRotation;

let currentIconUrl = null;
export function setTopRightIconFile(file) {
    const container = document.getElementById('image-container');
    if (!container || !file) return;
    if (currentIconUrl) {
        URL.revokeObjectURL(currentIconUrl);
        currentIconUrl = null;
    }
    const url = URL.createObjectURL(file);
    currentIconUrl = url;
    let el;
    if (file.type.startsWith('video/')) {
        el = document.createElement('video');
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.alt = 'immagine';
    }
    el.src = url;
    el.className = 'square-image';
    container.innerHTML = '';
    container.appendChild(el);
}

export function resetTopRightIcon() {
    const container = document.getElementById('image-container');
    if (!container) return;
    if (currentIconUrl) {
        URL.revokeObjectURL(currentIconUrl);
        currentIconUrl = null;
    }
    const input = document.getElementById('logo-file-input');
    if (input) input.value = '';
    const img = document.createElement('img');
    img.src = 'assets/icons/Logo.png';
    img.alt = 'immagine';
    img.className = 'square-image';
    container.innerHTML = '';
    container.appendChild(img);
}

window.setTopRightIconFile = setTopRightIconFile;
window.resetTopRightIcon = resetTopRightIcon;
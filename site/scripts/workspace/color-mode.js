// The WORKSPACE's colours: the choice (system, light, dark or greyscale) and the theme it gives (light, dark or
// greyscale), as data-theme on <html>. Loaded in the head, before anything is shown.

const colorModeKey = 'medsyntaxqa-color-mode';
const colorModes = ['system', 'light', 'dark', 'greyscale'];
const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)');

function storedColorMode() {
    try {
        const stored = localStorage.getItem(colorModeKey);
        return colorModes.includes(stored) ? stored : 'system';
    } catch (error) { // storage is blocked
        return 'system';
    }
}

let colorMode = storedColorMode();

function currentTheme() {
    if (colorMode === 'system') {
        return systemIsDark.matches ? 'dark' : 'light';
    }
    return colorMode;
}

function applyTheme() {
    const theme = currentTheme();
    if (document.documentElement.dataset.theme !== theme) {
        document.documentElement.dataset.theme = theme;
        document.dispatchEvent(new CustomEvent('medsyntax:theme'));
    }
}

function setColorMode(mode) {
    colorMode = mode;
    try {
        localStorage.setItem(colorModeKey, mode);
    } catch (error) {
        // storage is blocked: the choice lasts until the page closes
    }
    applyTheme();
}

applyTheme();
systemIsDark.addEventListener('change', applyTheme);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="color-mode"]').forEach((radio) => {
        radio.checked = radio.value === colorMode;
        radio.addEventListener('change', () => setColorMode(radio.value));
    });
});

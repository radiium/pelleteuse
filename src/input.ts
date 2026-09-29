import { t } from './i18n';
import type { I18nKey } from './i18n';

export const keys: Record<string, boolean> = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    setDevice('keyboard');
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// ── Périphérique utilisé en dernier : l'UI affiche touches clavier ou boutons manette ──

type InputDevice = 'keyboard' | 'gamepad';
let _device: InputDevice = 'keyboard';

function setDevice(device: InputDevice): void {
    if (device === _device) return;
    _device = device;
    document.body.classList.toggle('device-gamepad', device === 'gamepad');
}

// Appelé chaque frame : bascule en mode manette dès qu'elle est utilisée
export function pollInputDevice(): void {
    const gp = getGamepad();
    if (!gp) return;
    if (gp.buttons.some((b) => b.pressed) || gp.axes.slice(0, 4).some((a) => Math.abs(a) > 0.3)) {
        setDevice('gamepad');
    }
}

// ── Notification de connexion manette ─────────────────────────────────────────

const _toast = document.getElementById('toast')!;
let _toastTimer = 0;

function showToast(key: I18nKey): void {
    _toast.textContent = t(key);
    _toast.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = window.setTimeout(() => _toast.classList.remove('show'), 2500);
}

window.addEventListener('gamepadconnected', () => {
    showToast('gamepad.connected');
    setDevice('gamepad');
});
window.addEventListener('gamepaddisconnected', () => {
    showToast('gamepad.disconnected');
    if (!getGamepad()) setDevice('keyboard');
});

// ── Libellés des touches ──────────────────────────────────────────────────────
// Les contrôles utilisent des positions physiques (e.code) : KeyW = Z en AZERTY, W en QWERTY.
// On affiche la lettre réellement gravée sur le clavier du joueur : <kbd data-keycode="KeyW">

const AZERTY: Record<string, string> = { KeyW: 'Z', KeyA: 'Q' };

async function labelKeys(): Promise<void> {
    let layout: Map<string, string> | null = null;
    try {
        // Keyboard API (Chromium uniquement)
        const kb = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
        layout = kb ? await kb.getLayoutMap() : null;
    } catch { /* API refusée (iframe…) */ }
    // Sans l'API : on suppose AZERTY pour un navigateur en français
    const guessAzerty = navigator.language.startsWith('fr');

    for (const el of document.querySelectorAll<HTMLElement>('[data-keycode]')) {
        const code = el.dataset.keycode!;
        const label = layout?.get(code)
            ?? (guessAzerty ? AZERTY[code] : undefined)
            ?? code.replace(/^Key/, '');
        el.textContent = label.toUpperCase();
    }
}
void labelKeys();

export function getGamepad(): Gamepad | null {
    const gps = navigator.getGamepads();
    for (const gp of gps) if (gp) return gp;
    return null;
}

export function deadzone(v: number, dz = 0.12): number {
    return Math.abs(v) < dz ? 0 : v;
}

export interface Inputs {
    fwd: number;
    rot: number;
    jump: boolean;
    horn: boolean;
    fire: boolean;
    boomUp: number;
    stickExt: number;
    godetRot: number;
}

export function readInputs(): Inputs {
    const gp = getGamepad();
    const gpLX = gp ? deadzone(gp.axes[0]) : 0;
    const gpLY = gp ? deadzone(gp.axes[1]) : 0;
    const gpRX = gp ? deadzone(gp.axes[2]) : 0;
    const gpRY = gp ? deadzone(gp.axes[3]) : 0;

    return {
        fwd: (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - gpLY,
        rot:
            (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - gpLX,
        jump: !!(keys['Space'] || (gp?.buttons[2]?.pressed ?? false)),
        horn: !!(keys['KeyH'] || (gp?.buttons[1]?.pressed ?? false)),
        fire: !!(keys['KeyF'] || (gp?.buttons[0]?.pressed ?? false)),
        boomUp:
            (keys['KeyI'] ? 1 : 0) -
            (keys['KeyK'] ? 1 : 0) +
            (gp ? (gp.buttons[12]?.pressed ? 1 : gp.buttons[13]?.pressed ? -1 : 0) : 0),
        stickExt: (keys['KeyJ'] ? 1 : 0) - (keys['KeyL'] ? 1 : 0) - gpRX,
        godetRot: (keys['KeyU'] ? 1 : 0) - (keys['KeyO'] ? 1 : 0) - gpRY
    };
}

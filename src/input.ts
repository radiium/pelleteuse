// Indices des boutons manette (mapping « standard » de la Gamepad API)
export const PAD = { A: 0, B: 1, X: 2, START: 9, UP: 12, DOWN: 13 } as const;

const keys: Record<string, boolean> = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    setDevice('keyboard');
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});
// Fenêtre quittée touche enfoncée (Alt-Tab…) : le keyup n'arrivera jamais
window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
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

window.addEventListener('gamepadconnected', () => setDevice('gamepad'));
window.addEventListener('gamepaddisconnected', () => {
    if (!getGamepad()) setDevice('keyboard');
});

export function getGamepad(): Gamepad | null {
    const gps = navigator.getGamepads();
    for (const gp of gps) if (gp) return gp;
    return null;
}

function deadzone(v: number, dz = 0.12): number {
    return Math.abs(v) < dz ? 0 : v;
}

// Clavier + manette s'additionnent : on borne chaque axe à [-1, 1]
function axis(v: number): number {
    return Math.max(-1, Math.min(1, v));
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

// A sert aussi à valider le menu : en sortant du menu il est encore enfoncé,
// on ignore donc les flammes manette jusqu'à ce qu'il soit relâché
let _ignorePadFire = false;
export function ignorePadFireUntilRelease(): void {
    _ignorePadFire = true;
}

export function readInputs(): Inputs {
    const gp = getGamepad();
    const padFire = gp?.buttons[PAD.A]?.pressed ?? false;
    if (!padFire) _ignorePadFire = false;
    const gpLX = gp ? deadzone(gp.axes[0]) : 0;
    const gpLY = gp ? deadzone(gp.axes[1]) : 0;
    const gpRX = gp ? deadzone(gp.axes[2]) : 0;
    const gpRY = gp ? deadzone(gp.axes[3]) : 0;

    return {
        fwd: axis((keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - gpLY),
        rot: axis(
            (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - gpLX),
        jump: !!(keys['Space'] || (gp?.buttons[PAD.X]?.pressed ?? false)),
        horn: !!(keys['KeyH'] || (gp?.buttons[PAD.B]?.pressed ?? false)),
        fire: !!(keys['KeyF'] || (padFire && !_ignorePadFire)),
        boomUp: axis(
            (keys['KeyI'] ? 1 : 0) -
            (keys['KeyK'] ? 1 : 0) +
            (gp ? (gp.buttons[PAD.UP]?.pressed ? 1 : gp.buttons[PAD.DOWN]?.pressed ? -1 : 0) : 0)),
        stickExt: axis((keys['KeyJ'] ? 1 : 0) - (keys['KeyL'] ? 1 : 0) - gpRX),
        godetRot: axis((keys['KeyU'] ? 1 : 0) - (keys['KeyO'] ? 1 : 0) - gpRY)
    };
}

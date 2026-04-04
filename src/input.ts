export const keys: Record<string, boolean> = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

const gpIndicator = document.getElementById('gamepad-indicator')!;
window.addEventListener('gamepadconnected', () => {
    gpIndicator.textContent = '🎮 Manette : connectée ✓';
});
window.addEventListener('gamepaddisconnected', () => {
    gpIndicator.textContent = '🎮 Manette : non détectée';
});

export function getGamepad(): Gamepad | null {
    const gps = navigator.getGamepads();
    for (const gp of gps) if (gp) return gp;
    return null;
}

export function deadzone(v: number, dz = 0.12): number {
    return Math.abs(v) < dz ? 0 : v;
}

export interface Inputs {
    fwd:      number;
    rot:      number;
    jump:     boolean;
    horn:     boolean;
    fire:     boolean;
    boomUp:   number;
    stickExt: number;
    godetRot: number;
}

export function readInputs(): Inputs {
    const gp   = getGamepad();
    const gpLX = gp ? deadzone(gp.axes[0]) : 0;
    const gpLY = gp ? deadzone(gp.axes[1]) : 0;
    const gpRX = gp ? deadzone(gp.axes[2]) : 0;
    const gpRY = gp ? deadzone(gp.axes[3]) : 0;

    return {
        fwd:      (keys['KeyZ'] || keys['ArrowUp']    ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown']  ? 1 : 0) + gpLY,
        rot:      (keys['KeyQ'] || keys['ArrowLeft']  ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - gpLX,
        jump:     !!(keys['Space'] || (gp?.buttons[2]?.pressed ?? false)),
        horn:     !!(keys['KeyH'] || (gp?.buttons[1]?.pressed ?? false)),
        fire:     !!(keys['KeyF'] || (gp?.buttons[0]?.pressed ?? false)),
        boomUp:   (keys['KeyI'] ? 1 : 0) - (keys['KeyK'] ? 1 : 0) +
                  (gp ? (gp.buttons[12]?.pressed ? 1 : gp.buttons[13]?.pressed ? -1 : 0) : 0),
        stickExt: (keys['KeyJ'] ? 1 : 0) - (keys['KeyL'] ? 1 : 0) - gpRX,
        godetRot: (keys['KeyU'] ? 1 : 0) - (keys['KeyO'] ? 1 : 0) - gpRY,
    };
}

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

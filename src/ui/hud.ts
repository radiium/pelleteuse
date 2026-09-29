import { score } from '../score';
import type { ScoreKey } from '../score';
import { t } from './i18n';
import type { I18nKey } from './i18n';

// ── Compteurs ─────────────────────────────────────────────────────────────────

const ICONS: Record<ScoreKey, string> = { trees: '🌲', barrels: '🛢️', rocks: '🪨', monsters: '👾' };

// DOM construit une fois ; seules les valeurs sont mises à jour
const _values = (Object.keys(ICONS) as ScoreKey[]).map((key) => {
    const el = document.createElement('div');
    el.className = 'score';
    el.innerHTML = `<span class="icon">${ICONS[key]}</span><span class="value"></span>`;
    document.getElementById('hud-counters')!.appendChild(el);
    return { key, el: el.querySelector<HTMLElement>('.value')!, shown: -1 };
});

export function updateHUD(): void {
    for (const v of _values) {
        if (score[v.key] === v.shown) continue;
        v.shown = score[v.key];
        v.el.textContent = String(v.shown);
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

window.addEventListener('gamepadconnected', () => showToast('gamepad.connected'));
window.addEventListener('gamepaddisconnected', () => showToast('gamepad.disconnected'));

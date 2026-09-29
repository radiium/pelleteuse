import { getGamepad, PAD } from '../input';
import { getLang, LANGS, onLangChange, setLang, t } from './i18n';

// ── État de jeu ───────────────────────────────────────────────────────────────

export type GameState = 'title' | 'playing' | 'paused';

let _state: GameState = 'title';
export function getGameState(): GameState { return _state; }

interface MenuHandlers {
    onStart():  void;
    onPause():  void;
    onResume(): void;
    onReset():  void;  // remet le monde à neuf (Recommencer / Accueil)
}
let _handlers: MenuHandlers | null = null;
export function initMenu(handlers: MenuHandlers): void { _handlers = handlers; }

// ── DOM ───────────────────────────────────────────────────────────────────────

const _sub     = document.getElementById('menu-sub')!;
const _play    = document.getElementById('btn-play')!;
const _restart = document.getElementById('btn-restart')!;
const _home    = document.getElementById('btn-home')!;
const _hint    = document.getElementById('menu-hint')!;

// Sélecteur de langue
const _langBtns = LANGS.map((lang) => {
    const btn = document.createElement('button');
    btn.textContent  = lang.toUpperCase();
    btn.dataset.lang = lang;
    btn.addEventListener('click', () => { btn.blur(); setLang(lang); });
    document.getElementById('lang-switch')!.appendChild(btn);
    return btn;
});

// Le rappel « Menu » en jeu : bien visible au début, puis s'estompe (réapparaît au survol)
const HINT_DIM_DELAY = 4000;
let _hintTimer = 0;
function showHintBriefly(): void {
    _hint.classList.remove('dim');
    clearTimeout(_hintTimer);
    _hintTimer = window.setTimeout(() => _hint.classList.add('dim'), HINT_DIM_DELAY);
}

function render(): void {
    const paused = _state === 'paused';
    document.body.classList.toggle('menu-open', _state !== 'playing');
    for (const btn of _langBtns) btn.classList.toggle('active', btn.dataset.lang === getLang());
    if (_state === 'playing') {
        // Un bouton resté focus en jeu serait déclenché par Espace (= saut)
        (document.activeElement as HTMLElement | null)?.blur();
        showHintBriefly();
        return; // textes figés pendant le fondu de sortie (sinon on voit l'accueil au retour de pause)
    }
    _sub.textContent   = t(paused ? 'menu.pause'  : 'menu.tagline');
    _play.textContent  = t(paused ? 'menu.resume' : 'menu.play');
    _restart.hidden    = !paused;
    _home.hidden       = !paused;
}

// ── Transitions ───────────────────────────────────────────────────────────────

function advance(): void {
    if (_state === 'title')       { _state = 'playing'; _handlers?.onStart(); }
    else if (_state === 'paused') { _state = 'playing'; _handlers?.onResume(); }
    render();
}

function togglePause(): void {
    if (_state === 'playing')     { _state = 'paused';  _handlers?.onPause(); }
    else if (_state === 'paused') { _state = 'playing'; _handlers?.onResume(); }
    render();
}

function restart(): void {
    _handlers?.onReset();
    _state = 'playing';
    _handlers?.onStart();
    render();
}

function goHome(): void {
    _handlers?.onReset();
    _state = 'title';
    render();
}

_play.addEventListener('click', advance);
_restart.addEventListener('click', restart);
_home.addEventListener('click', goHome);
_hint.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape') togglePause();
    // Entrée sur un bouton focus : on laisse le bouton gérer son propre clic
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && _state !== 'playing'
             && !(document.activeElement instanceof HTMLButtonElement)) advance();
});

// Fenêtre quittée (Alt-Tab, changement d'onglet) : pause automatique
window.addEventListener('blur', () => {
    if (_state === 'playing') togglePause();
});

onLangChange(render);

// Manette : A confirme, Start confirme ou met en pause — détection de front
let _gpA = false, _gpStart = false;
export function pollMenuGamepad(): void {
    const gp = getGamepad();
    const a     = gp?.buttons[PAD.A]?.pressed ?? false;
    const start = gp?.buttons[PAD.START]?.pressed ?? false;
    if (a && !_gpA && _state !== 'playing') advance();
    else if (start && !_gpStart) {
        if (_state === 'title') advance(); else togglePause();
    }
    _gpA = a; _gpStart = start;
}

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

render();

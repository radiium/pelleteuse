// ── Dictionnaires ─────────────────────────────────────────────────────────────
// `fr` est la référence : `en` doit définir exactement les mêmes clés (vérifié par tsc)

const fr = {
    'title':             'PELLETEUSE',
    'menu.tagline':      '⚠️ Attention, travaux ! ⚠️',
    'menu.pause':        '— PAUSE —',
    'menu.play':         '▶ Jouer',
    'menu.resume':       '▶ Reprendre',
    'menu.restart':      '↻ Recommencer',
    'menu.home':         '⌂ Accueil',
    'menu.keyhint':      'ou Entrée / bouton A',

    'controls.move':     'Déplacement',
    'controls.arm':      'Bras',
    'controls.actions':  'Actions',
    'controls.menu':     'Menu',

    'pad.stickL':        'Stick G',
    'pad.stickR':        'Stick D',
    'pad.dpad':          'Croix',

    'action.fwdBack':    'Avancer / reculer',
    'action.turn':       'Tourner',
    'action.jump':       'Sauter',
    'action.boom':       'Flèche',
    'action.stick':      'Avant-bras',
    'action.bucket':     'Godet',
    'action.flames':     'Flammes',
    'action.horn':       'Klaxon',
    'action.pause':      'Pause',

    'key.space':         'Espace',
    'key.escape':        'Échap',

    'gamepad.connected':    '🎮 Manette connectée',
    'gamepad.disconnected': '🎮 Manette déconnectée',
};

export type I18nKey = keyof typeof fr;

const en: Record<I18nKey, string> = {
    'title':             'EXCAVATOR',
    'menu.tagline':      '⚠️ Caution, work zone! ⚠️',
    'menu.pause':        '— PAUSED —',
    'menu.play':         '▶ Play',
    'menu.resume':       '▶ Resume',
    'menu.restart':      '↻ Restart',
    'menu.home':         '⌂ Home',
    'menu.keyhint':      'or Enter / A button',

    'controls.move':     'Movement',
    'controls.arm':      'Arm',
    'controls.actions':  'Actions',
    'controls.menu':     'Menu',

    'pad.stickL':        'L stick',
    'pad.stickR':        'R stick',
    'pad.dpad':          'D-pad',

    'action.fwdBack':    'Forward / back',
    'action.turn':       'Turn',
    'action.jump':       'Jump',
    'action.boom':       'Boom',
    'action.stick':      'Stick',
    'action.bucket':     'Bucket',
    'action.flames':     'Flames',
    'action.horn':       'Horn',
    'action.pause':      'Pause',

    'key.space':         'Space',
    'key.escape':        'Esc',

    'gamepad.connected':    '🎮 Gamepad connected',
    'gamepad.disconnected': '🎮 Gamepad disconnected',
};

const DICTS = { fr, en };
export type Lang = keyof typeof DICTS;
export const LANGS = Object.keys(DICTS) as Lang[];

// ── Langue courante : choix mémorisé > langue du navigateur > anglais ────────

const LANG_KEY = 'pelleteuse.lang';

function detectLang(): Lang {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved && saved in DICTS) return saved as Lang;
    } catch { /* localStorage indisponible */ }
    const nav = navigator.language.slice(0, 2);
    return nav in DICTS ? nav as Lang : 'en';
}

let _lang = detectLang();
const _listeners: (() => void)[] = [];

export function getLang(): Lang { return _lang; }

export function t(key: I18nKey): string { return DICTS[_lang][key]; }

export function setLang(lang: Lang): void {
    _lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignoré */ }
    applyStatic();
    for (const cb of _listeners) cb();
}

// Pour les textes posés en JS (menu, manette…) : rappelé à chaque changement de langue
export function onLangChange(cb: () => void): void { _listeners.push(cb); }

// Textes statiques du HTML : <span data-i18n="clé">
function applyStatic(): void {
    document.documentElement.lang = _lang;
    for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
        el.textContent = t(el.dataset.i18n as I18nKey);
    }
}

applyStatic();

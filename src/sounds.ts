// Conventions : playX() = son ponctuel, startX()/stopX() = boucle, updateMotor() = moteur continu

// Résolution des URLs par Vite (les fichiers vivent dans src/assets/sounds/)
const _url = (file: string) => new URL(`./assets/sounds/${file}`, import.meta.url).href;

// Contexte Web Audio unique (moteur + sons procéduraux), suspendu par le navigateur jusqu'au premier geste
const _ctx = new AudioContext();

// Appelé sur un geste utilisateur (écran d'accueil) : lève le blocage audio du navigateur
export function unlockAudio(): void {
    void _ctx.resume();
}

// Un bouton de manette ne compte pas comme geste utilisateur : on profite du premier vrai geste
for (const ev of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(ev, unlockAudio, { once: true });
}

// Coupe le son Web Audio pendant la pause (updateMotor le relance automatiquement)
export function suspendAudio(): void {
    if (_ctx.state === 'running') void _ctx.suspend();
}

// ── Fichiers audio (HTMLAudioElement) ─────────────────────────────────────────

// Son ponctuel : un clone par lecture pour que les sons se chevauchent sans se couper.
// .catch : play() rejette tant que l'audio n'est pas débloqué par un geste utilisateur
function oneShot(file: string): () => void {
    const audio = new Audio(_url(file));
    return () => { (audio.cloneNode() as HTMLAudioElement).play().catch(() => {}); };
}

export const playHorn       = oneShot('horn.ogg');
export const playExplosion  = oneShot('explosion.ogg');
export const playRockBreak  = oneShot('rock.ogg');
export const playTreeCrack  = oneShot('tree.ogg');

const _flame = new Audio(_url('flame.ogg'));
_flame.loop = true;

export function startFlame(): void {
    if (!_flame.paused) return;
    _flame.play().catch(() => {});
}

export function stopFlame(): void {
    _flame.pause();
    _flame.currentTime = 0;
}

// ── Moteur — Web Audio pour contrôle du pitch ─────────────────────────────────

let _motor: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

async function loadMotor(): Promise<void> {
    try {
        const buf = await fetch(_url('motor.ogg'))
            .then((r) => r.arrayBuffer())
            .then((a) => _ctx.decodeAudioData(a));
        const gain = _ctx.createGain();
        gain.gain.value = 0.25;
        gain.connect(_ctx.destination);
        const source = _ctx.createBufferSource();
        source.buffer = buf;
        source.loop = true;
        source.playbackRate.value = 0.8;
        source.connect(gain);
        source.start(); // ne s'entend qu'une fois le contexte débloqué
        _motor = { source, gain };
    } catch { /* fichier manquant — silencieux */ }
}
void loadMotor();

// inputMag : 0 (arrêt) → 1 (pleine vitesse)
export function updateMotor(inputMag: number): void {
    if (_ctx.state === 'suspended') void _ctx.resume();
    if (!_motor) return;
    const t     = _ctx.currentTime;
    const speed = Math.min(1, Math.max(0, inputMag));
    _motor.source.playbackRate.setTargetAtTime(0.8 + speed * 0.7, t, 0.08);
    _motor.gain.gain.setTargetAtTime(0.25 + speed * 0.35, t, 0.08);
}

// ── Sons procéduraux (Web Audio) ──────────────────────────────────────────────

function playTone(type: OscillatorType, freqStart: number, freqEnd: number, gainStart: number, duration: number): void {
    const t   = _ctx.currentTime;
    const osc = _ctx.createOscillator();
    osc.type  = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(gainStart, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(_ctx.destination);
    osc.start(t); osc.stop(t + duration);
}

export function playJump(): void { playTone('sine', 140, 520, 0.30, 0.22); }
export function playLand(): void { playTone('sine',  90,  35, 0.45, 0.18); }

export function playMonster(): void {
    const t   = _ctx.currentTime;
    const osc = _ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const lfo     = _ctx.createOscillator();
    lfo.frequency.value = 20;
    const lfoGain = _ctx.createGain();
    lfoGain.gain.value  = 50;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain); gain.connect(_ctx.destination);
    lfo.start(t); osc.start(t);
    osc.stop(t + 0.5); lfo.stop(t + 0.5);
}

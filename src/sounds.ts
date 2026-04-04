// Résolution des URLs par Vite (les fichiers vivent dans src/assets/sounds/)
const _url = (file: string) => new URL(`./assets/sounds/${file}`, import.meta.url).href;

// ── HTMLAudioElement — sons one-shot et loops simples ─────────────────────────

const _flame     = new Audio(_url('flame.ogg'));     _flame.loop = true;
const _horn      = new Audio(_url('horn.ogg'));
const _explosion = new Audio(_url('explosion.ogg'));
const _rock      = new Audio(_url('rock.ogg'));
const _tree      = new Audio(_url('tree.ogg'));

// ── Moteur — Web Audio pour contrôle du pitch ─────────────────────────────────

let _motorCtx:    AudioContext | null          = null;
let _motorSource: AudioBufferSourceNode | null = null;
let _motorGain:   GainNode | null              = null;
let _motorReady   = false;

async function _loadMotor(): Promise<void> {
    const ctx = new AudioContext();
    _motorCtx = ctx;
    await ctx.resume(); // lève la suspension imposée par le navigateur
    try {
        const buf = await fetch(_url('motor.ogg'))
            .then(r => r.arrayBuffer())
            .then(a => ctx.decodeAudioData(a));
        _motorGain              = ctx.createGain();
        _motorGain.gain.value   = 0.25;
        _motorGain.connect(ctx.destination);
        _motorSource            = ctx.createBufferSource();
        _motorSource.buffer     = buf;
        _motorSource.loop       = true;
        _motorSource.playbackRate.value = 0.8;
        _motorSource.connect(_motorGain);
        _motorSource.start();
        _motorReady = true;
    } catch (_) { /* fichier manquant — silencieux */ }
}

// inputMag : 0 (arrêt) → 1 (pleine vitesse)
export function updateMotor(inputMag: number): void {
    if (!_motorCtx)  { void _loadMotor(); return; }
    if (_motorCtx.state === 'suspended') void _motorCtx.resume();
    if (!_motorReady || !_motorSource || !_motorGain) return;
    const t     = _motorCtx.currentTime;
    const speed = Math.min(1, Math.max(0, inputMag));

    _motorSource.playbackRate.setTargetAtTime(0.8 + speed * 0.7, t, 0.08);
    _motorGain.gain.setTargetAtTime(0.25 + speed * 0.35, t, 0.08);
    // _motorSource.playbackRate.setTargetAtTime(0.8 + speed * 0.7, t, 0.25);
    // _motorGain.gain.setTargetAtTime(0.25 + speed * 0.35, t, 0.15);
}

// ── Flamme ────────────────────────────────────────────────────────────────────

export function startFlame(): void {
    if (!_flame.paused) return;
    void _flame.play();
}

export function stopFlame(): void {
    _flame.pause();
    _flame.currentTime = 0;
}

// ── Klaxon (one-shot) ─────────────────────────────────────────────────────────

export function playHorn(): void {
    _horn.currentTime = 0;
    void _horn.play();
}

// ── Collisions ────────────────────────────────────────────────────────────────

export function soundExplosion(): void { _explosion.currentTime = 0; void _explosion.play(); }
export function soundRock():      void { _rock.currentTime = 0;      void _rock.play(); }
export function soundCrack():     void { _tree.currentTime = 0;      void _tree.play(); }

// ── Sons procéduraux (Web Audio) ──────────────────────────────────────────────

let _procCtx: AudioContext | null = null;

function pac(): AudioContext {
    if (!_procCtx) _procCtx = new AudioContext();
    return _procCtx;
}

export function soundJump(): void {
    const ctx = pac();
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.22);
}

export function soundLand(): void {
    const ctx = pac();
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.18);
}

export function soundMonster(): void {
    const ctx = pac();
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const lfo     = ctx.createOscillator();
    lfo.frequency.value = 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value  = 50;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain); gain.connect(ctx.destination);
    lfo.start(t); osc.start(t);
    osc.stop(t + 0.5); lfo.stop(t + 0.5);
}

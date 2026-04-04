// Klaxon généré via Web Audio API — deux oscillateurs désaccordés pour un son
// de corne d'engin de chantier. Le contexte audio est créé au premier appel
// (obligation navigateur : AudioContext doit naître après une interaction).

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let playing = false;

function ensureContext(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    return ctx;
}

export function startHorn(): void {
    if (playing) return;
    playing = true;

    const ac = ensureContext();

    gain = ac.createGain();
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ac.currentTime + 0.04);
    gain.connect(ac.destination);

    // Fréquences d'un klaxon de pelleteuse : fondamentale + quinte légèrement désaccordée
    osc1 = ac.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 185;
    osc1.connect(gain);
    osc1.start();

    osc2 = ac.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 278; // ~quinte + 3 Hz de battement
    osc2.connect(gain);
    osc2.start();
}

export function stopHorn(): void {
    if (!playing || !gain || !osc1 || !osc2 || !ctx) return;
    playing = false;

    const ac = ctx;
    const g  = gain;
    const o1 = osc1;
    const o2 = osc2;

    g.gain.setValueAtTime(g.gain.value, ac.currentTime);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.06);

    const stopAt = ac.currentTime + 0.07;
    o1.stop(stopAt);
    o2.stop(stopAt);

    gain = null;
    osc1 = null;
    osc2 = null;
}

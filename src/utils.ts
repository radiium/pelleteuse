/** Facteur d'interpolation exponentielle frame-rate indépendant. */
export function expDecay(rate: number, dt: number): number {
    return 1 - Math.exp(-rate * dt);
}

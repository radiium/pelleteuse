// Compteurs de destruction de la partie en cours

export const score = { trees: 0, barrels: 0, rocks: 0, monsters: 0 };
export type ScoreKey = keyof typeof score;

export function resetScore(): void {
    for (const k in score) score[k as ScoreKey] = 0;
}

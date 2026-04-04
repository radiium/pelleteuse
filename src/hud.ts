import { getDestroyedCounts } from './world';
import { getDestroyedMonsters } from './characters';

const _el = document.getElementById('hud-counters')!;
let _prevTrees = -1, _prevBarrels = -1, _prevRocks = -1, _prevMonsters = -1;

export function updateHUD(): void {
    const { trees, barrels, rocks } = getDestroyedCounts();
    const monsters = getDestroyedMonsters();
    if (trees === _prevTrees && barrels === _prevBarrels && rocks === _prevRocks && monsters === _prevMonsters) return;
    _prevTrees = trees; _prevBarrels = barrels; _prevRocks = rocks; _prevMonsters = monsters;
    _el.innerHTML =
        `<div class="score"><span class="icon">🌲</span><span class="value">${trees}</span></div>` +
        `<div class="score"><span class="icon">🛢️</span><span class="value">${barrels}</span></div>` +
        `<div class="score"><span class="icon">🪨</span><span class="value">${rocks}</span></div>` +
        `<div class="score"><span class="icon">👾</span><span class="value">${monsters}</span></div>`;
}

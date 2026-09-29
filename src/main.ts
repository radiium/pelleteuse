import * as THREE from 'three';
import './style.css';

// Ordre d'initialisation : chaque module construit sa part de la scène à l'import
import { camera, renderer, scene } from './scene';
import { updateSun } from './lights';
import './terrain';
import { excavator } from './excavator';
import { resetEntities, updateEntities } from './entities';
import { clearParticles, updateAllParticles } from './particles';
import { ignorePadFireUntilRelease, pollInputDevice, readInputs } from './input';
import { playIntro, resetPlayer, silencePlayer, updatePlayer } from './player';
import { settleCamera, syncOrbitToCamera, updateChaseCamera, updateOrbitCamera } from './camera';
import { resetScore } from './score';
import { updateHUD } from './ui/hud';
import { unlockAudio } from './sounds';
import { getGameState, initMenu, pollMenuGamepad } from './ui/menu';

const _farAway = new THREE.Vector3(1e6, 0, 1e6); // sur l'écran titre, les monstres errent sans fuir ni être écrasés

initMenu({
    onStart() {
        unlockAudio();
        playIntro();
        settleCamera();
        ignorePadFireUntilRelease();
    },
    onPause() {
        silencePlayer();
        syncOrbitToCamera();
    },
    onResume() {
        settleCamera();
        ignorePadFireUntilRelease();
    },
    onReset() {
        resetEntities();
        clearParticles();
        resetScore();
        resetPlayer();
    },
});

function updateGame(dt: number): void {
    const inp = readInputs();
    updatePlayer(dt, inp);
    updateEntities(dt, excavator.group.position);
    updateAllParticles(dt);
    updateHUD();
    updateChaseCamera(dt, Math.abs(inp.fwd) > 0.05 || Math.abs(inp.rot) > 0.05);
}

// Écran d'accueil / pause : caméra en orbite ; sur l'écran titre le monde reste vivant, en pause tout est figé
function updateMenu(dt: number): void {
    updateOrbitCamera(dt);
    if (getGameState() === 'title') {
        updateEntities(dt, _farAway);
        updateAllParticles(dt);
    }
}

const timer = new THREE.Timer();

function animate(): void {
    requestAnimationFrame(animate);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    pollInputDevice();
    pollMenuGamepad();
    if (getGameState() === 'playing') updateGame(dt);
    else updateMenu(dt);
    updateSun(excavator.group.position);
    renderer.render(scene, camera);
}

animate();

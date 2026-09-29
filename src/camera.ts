import * as THREE from 'three';
import { camera } from './scene';
import { excavator } from './excavator';
import { getHeading } from './player';
import { sampleHeight } from './terrain';
import { expDecay, UP } from './utils';

// Caméra : poursuite derrière la pelleteuse en jeu, orbite lente dans les menus

const CAM_SETTLE   = 1.5;  // durée du retour caméra vers la chase cam (s)
const ORBIT_RADIUS = 16;
const ORBIT_HEIGHT = 6;
const ORBIT_SPEED  = 0.15;
const MENU_LOOK_UP = 6.5;  // vise au-dessus de la pelleteuse → elle apparaît sous la card du menu

const _target = excavator.group.position;

let _orbitAngle     = Math.PI * 0.75; // vue 3/4 arrière au lancement
let _camSettleTimer = 0;

const _camLookAt    = new THREE.Vector3();
const _prevExcPos   = new THREE.Vector3();
const _camDelta     = new THREE.Vector3();
const _camOffset    = new THREE.Vector3();
const _camDesired   = new THREE.Vector3();
const _lookAtTarget = new THREE.Vector3();

/** Ramène la caméra derrière la pelleteuse même si elle ne bouge pas (démarrage, reprise). */
export function settleCamera(): void {
    _camSettleTimer = CAM_SETTLE;
}

/** L'orbite du menu repart de la position actuelle de la caméra (entrée en pause). */
export function syncOrbitToCamera(): void {
    _orbitAngle = Math.atan2(camera.position.x - _target.x, camera.position.z - _target.z) - getHeading();
}

// Empêche la caméra de passer sous le terrain (collines de bordure)
function keepAboveGround(): void {
    const ground = sampleHeight(camera.position.x, camera.position.z) + 1;
    if (camera.position.y < ground) camera.position.y = ground;
}

export function updateChaseCamera(dt: number, moving: boolean): void {
    _camDelta.copy(_target).sub(_prevExcPos);
    camera.position.add(_camDelta);
    _prevExcPos.copy(_target);
    _camSettleTimer = Math.max(0, _camSettleTimer - dt);
    if (moving || _camSettleTimer > 0) {
        _camOffset.set(0, 7, -20).applyAxisAngle(UP, getHeading());
        _camDesired.copy(_target).add(_camOffset);
        camera.position.lerp(_camDesired, expDecay(_camSettleTimer > 0 ? 3 : 1.5, dt));
    }
    _lookAtTarget.copy(_target);
    _lookAtTarget.y += 1.5;
    _camLookAt.lerp(_lookAtTarget, expDecay(8, dt));
    keepAboveGround();
    camera.lookAt(_camLookAt);
}

export function updateOrbitCamera(dt: number): void {
    _orbitAngle += ORBIT_SPEED * dt;
    const angle = getHeading() + _orbitAngle;
    _camDesired.set(
        _target.x + Math.sin(angle) * ORBIT_RADIUS,
        _target.y + ORBIT_HEIGHT,
        _target.z + Math.cos(angle) * ORBIT_RADIUS,
    );
    camera.position.lerp(_camDesired, expDecay(2, dt));
    _prevExcPos.copy(_target);
    _lookAtTarget.copy(_target);
    _lookAtTarget.y += 1.5 + MENU_LOOK_UP;
    _camLookAt.lerp(_lookAtTarget, expDecay(3, dt));
    keepAboveGround();
    camera.lookAt(_camLookAt);
}

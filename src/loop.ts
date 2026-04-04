import * as THREE from 'three';
import { excavator } from './excavator';
import { deadzone, getGamepad, keys } from './input';
import './lights';
import { camera, controls, renderer, scene } from './scene';
import { sampleHeight, terrainGeo, TERRAIN_SIZE } from './terrain';
import { spawnDust, spawnFlame, updateAllParticles } from './particles';
import { checkCollisions } from './world';
import { ARM_SPEED, SPEED, TURN } from './config';
import { soundJump, soundLand, playHorn, startFlame, stopFlame, updateMotor } from './sounds';
import { updateCharacters } from './characters';

const timer = new THREE.Timer();

let heading = 0;
const slopeQuat = new THREE.Quaternion();
const _worldUp  = new THREE.Vector3(0, 1, 0);

// ── Chase cam ──
controls.enabled = false;
const _camLookAt  = new THREE.Vector3();
const _prevExcPos = new THREE.Vector3();

// ── Saut ──
const JUMP_FORCE   = 9;
const JUMP_GRAVITY = 24;
let _velY     = 0;
let _onGround = true;

// ── Timers / état son ──
let _dustTimer      = 0;
let _flameTimer     = 0;
let _hornWasActive  = false;
const _dustPosL = new THREE.Vector3();
const _dustPosR = new THREE.Vector3();

function update(dt: number): void {
    const gp = getGamepad();

    const gpLX = gp ? deadzone(gp.axes[0]) : 0;
    const gpLY = gp ? deadzone(gp.axes[1]) : 0;
    const gpRX = gp ? deadzone(gp.axes[2]) : 0;
    const gpRY = gp ? deadzone(gp.axes[3]) : 0;

    // ── Déplacement ──
    const fwd =
        (keys['KeyZ'] || keys['ArrowUp']    ? 1 : 0) -
        (keys['KeyS'] || keys['ArrowDown']  ? 1 : 0) + gpLY;
    const rot =
        (keys['KeyQ'] || keys['ArrowLeft']  ? 1 : 0) -
        (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - gpLX;

    // Freinage progressif vers les bords
    const ex        = excavator.group.position;
    const half      = TERRAIN_SIZE / 2;
    const dist      = Math.sqrt(ex.x * ex.x + ex.z * ex.z);
    const slowStart = half * 0.78;
    const slowEnd   = half * 0.93;
    // Produit scalaire direction / vecteur radial sortant : >0 = vers le bord, <0 = vers le centre
    const outwardDot = dist > 0
        ? Math.sin(heading) * (ex.x / dist) + Math.cos(heading) * (ex.z / dist)
        : 0;
    const speedMult = dist > slowStart && outwardDot > 0
        ? Math.max(0.08, 1 - (dist - slowStart) / (slowEnd - slowStart) * 0.92)
        : 1.0;

    heading += rot * TURN * dt;
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    excavator.group.position.addScaledVector(dir, fwd * SPEED * speedMult * dt);

    // Terrain + saut
    const pos = terrainGeo.attributes.position;
    const h   = sampleHeight(ex.x, ex.z, pos);

    const jumpPressed = keys['Space'] || (gp?.buttons[2]?.pressed ?? false);
    if (_onGround && jumpPressed) {
        _velY     = JUMP_FORCE;
        _onGround = false;
        soundJump();
    }

    if (_onGround) {
        ex.y = h;
    } else {
        _velY -= JUMP_GRAVITY * dt;
        ex.y  += _velY * dt;
        if (ex.y <= h) {
            ex.y      = h;
            _velY     = 0;
            _onGround = true;
            soundLand();
        }
    }

    // Inclinaison selon la pente du terrain
    const sd = 1.5;
    const hR = sampleHeight(ex.x + sd, ex.z, pos);
    const hF = sampleHeight(ex.x, ex.z + sd, pos);
    const vRight = new THREE.Vector3(sd, hR - h, 0);
    const vFwd   = new THREE.Vector3(0,  hF - h, sd);
    const terrainNormal   = new THREE.Vector3().crossVectors(vFwd, vRight).normalize();
    const targetSlopeQuat = new THREE.Quaternion().setFromUnitVectors(_worldUp, terrainNormal);
    slopeQuat.slerp(targetSlopeQuat, 1 - Math.exp(-5 * dt));
    excavator.group.quaternion
        .copy(slopeQuat)
        .multiply(new THREE.Quaternion().setFromAxisAngle(_worldUp, heading));

    excavator.animateTracks(fwd * SPEED * dt * 0.5);

    checkCollisions(excavator.group.position, dt);

    // ── Poussière chenilles ──
    if (Math.abs(fwd) > 0.05 || Math.abs(rot) > 0.05) {
        _dustTimer += dt;
        while (_dustTimer >= 0.06) {
            _dustTimer -= 0.06;
            excavator.dustSpawnL.getWorldPosition(_dustPosL);
            excavator.dustSpawnR.getWorldPosition(_dustPosR);
            spawnDust(_dustPosL);
            spawnDust(_dustPosR);
        }
    } else {
        _dustTimer = 0;
    }

    // ── Moteur ──
    updateMotor(Math.min(1, Math.abs(fwd) + Math.abs(rot) * 0.4));

    // ── Klaxon (H / bouton 1) — one-shot par pression ──
    const hornActive = keys['KeyH'] || (gp?.buttons[1]?.pressed ?? false);
    if (hornActive && !_hornWasActive) playHorn();
    _hornWasActive = hornActive;

    // ── Flammes (F / bouton 0) ──
    const fireActive = keys['KeyF'] || (gp?.buttons[0]?.pressed ?? false);
    if (fireActive) {
        startFlame();
        _flameTimer += dt;
        while (_flameTimer >= 0.03) {
            _flameTimer -= 0.03;
            for (let f = 0; f < 4; f++) spawnFlame(excavator.flameSpawn);
        }
    } else {
        stopFlame();
        _flameTimer = 0;
    }

    updateAllParticles(dt);
    updateCharacters(dt, excavator.group.position);

    // ── Bras ──
    const boomUp =
        (keys['KeyI'] ? 1 : 0) - (keys['KeyK'] ? 1 : 0) +
        (gp ? (gp.buttons[12]?.pressed ? 1 : gp.buttons[13]?.pressed ? -1 : 0) : 0);
    const stickExt = (keys['KeyJ'] ? 1 : 0) - (keys['KeyL'] ? 1 : 0) - gpRX;
    const godetRot = (keys['KeyU'] ? 1 : 0) - (keys['KeyO'] ? 1 : 0) - gpRY;

    excavator.boomPivot.rotation.x  = THREE.MathUtils.clamp(excavator.boomPivot.rotation.x  - boomUp   * ARM_SPEED * dt, -1.2,  0.3);
    excavator.stickPivot.rotation.x = THREE.MathUtils.clamp(excavator.stickPivot.rotation.x + stickExt * ARM_SPEED * dt,  0,    1.4);
    excavator.godetPivot.rotation.x = THREE.MathUtils.clamp(excavator.godetPivot.rotation.x + godetRot * ARM_SPEED * dt, -1.0,  0.8);

    // ── Chase cam ──
    camera.position.add(excavator.group.position.clone().sub(_prevExcPos));
    _prevExcPos.copy(excavator.group.position);
    if (Math.abs(fwd) > 0.05 || Math.abs(rot) > 0.05) {
        const desired = excavator.group.position.clone().add(
            new THREE.Vector3(0, 7, -20).applyAxisAngle(_worldUp, heading)
        );
        camera.position.lerp(desired, 1 - Math.exp(-1.5 * dt));
    }
    _camLookAt.lerp(
        excavator.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        1 - Math.exp(-8 * dt)
    );
    camera.lookAt(_camLookAt);
}

function animate(): void {
    requestAnimationFrame(animate);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    update(dt);
    renderer.render(scene, camera);
}

animate();

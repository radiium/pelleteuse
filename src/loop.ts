import * as THREE from 'three';
import { excavator } from './excavator';
import { readInputs } from './input';
import type { Inputs } from './input';
import './lights';
import { camera, controls, renderer, scene } from './scene';
import { sampleHeight, terrainGeo, TERRAIN_SIZE } from './terrain';
import { spawnDust, spawnFlame, updateAllParticles } from './particles';
import { checkCollisions } from './world';
import { ARM_SPEED, DUST_INTERVAL, FLAME_INTERVAL, JUMP_FORCE, JUMP_GRAVITY, SLOPE_SAMPLE_DIST, SPEED, TURN } from './config';
import { soundJump, soundLand, playHorn, startFlame, stopFlame, updateMotor } from './sounds';
import { updateCharacters } from './characters';
import { expDecay } from './utils';
import { updateHUD } from './hud';

const timer = new THREE.Timer();

let heading = 0;
const slopeQuat = new THREE.Quaternion();
const _worldUp  = new THREE.Vector3(0, 1, 0);

// ── Chase cam ──
controls.enabled = false;
const _camLookAt  = new THREE.Vector3();
const _prevExcPos = new THREE.Vector3();

// ── Saut ──
let _velY     = 0;
let _onGround = true;

// ── Timers / état son ──
let _dustTimer     = 0;
let _flameTimer    = 0;
let _hornWasActive = false;
const _dustPosL = new THREE.Vector3();
const _dustPosR = new THREE.Vector3();

// ── Vecteurs/quaternions pré-alloués (zéro allocation par frame) ──────────────
const _dir             = new THREE.Vector3();
const _vRight          = new THREE.Vector3();
const _vFwd            = new THREE.Vector3();
const _terrainNormal   = new THREE.Vector3();
const _targetSlopeQuat = new THREE.Quaternion();
const _headingQuat     = new THREE.Quaternion();
const _camDelta        = new THREE.Vector3();
const _camOffset       = new THREE.Vector3();
const _camDesired      = new THREE.Vector3();
const _lookAtTarget    = new THREE.Vector3();

function update(dt: number): void {
    const inp = readInputs();

    // ── Déplacement ──
    const ex        = excavator.group.position;
    const half      = TERRAIN_SIZE / 2;
    const dist      = Math.sqrt(ex.x * ex.x + ex.z * ex.z);
    const slowStart = half * 0.78;
    const slowEnd   = half * 0.93;
    const outwardDot = dist > 0
        ? Math.sin(heading) * (ex.x / dist) + Math.cos(heading) * (ex.z / dist)
        : 0;
    const speedMult = dist > slowStart && outwardDot > 0
        ? Math.max(0.08, 1 - (dist - slowStart) / (slowEnd - slowStart) * 0.92)
        : 1.0;

    heading += inp.rot * TURN * dt;
    _dir.set(Math.sin(heading), 0, Math.cos(heading));
    excavator.group.position.addScaledVector(_dir, inp.fwd * SPEED * speedMult * dt);

    // ── Terrain + saut ──
    const pos = terrainGeo.attributes.position;
    const h   = sampleHeight(ex.x, ex.z, pos);

    if (_onGround && inp.jump) {
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

    // ── Inclinaison selon la pente ──
    const hR = sampleHeight(ex.x + SLOPE_SAMPLE_DIST, ex.z, pos);
    const hF = sampleHeight(ex.x, ex.z + SLOPE_SAMPLE_DIST, pos);
    _vRight.set(SLOPE_SAMPLE_DIST, hR - h, 0);
    _vFwd.set(0, hF - h, SLOPE_SAMPLE_DIST);
    _terrainNormal.crossVectors(_vFwd, _vRight).normalize();
    _targetSlopeQuat.setFromUnitVectors(_worldUp, _terrainNormal);
    slopeQuat.slerp(_targetSlopeQuat, expDecay(5, dt));
    _headingQuat.setFromAxisAngle(_worldUp, heading);
    excavator.group.quaternion.copy(slopeQuat).multiply(_headingQuat);

    excavator.animateTracks(inp.fwd * SPEED * dt * 0.5);

    checkCollisions(excavator.group.position, dt);

    // ── Poussière chenilles ──
    if (Math.abs(inp.fwd) > 0.05 || Math.abs(inp.rot) > 0.05) {
        _dustTimer += dt;
        while (_dustTimer >= DUST_INTERVAL) {
            _dustTimer -= DUST_INTERVAL;
            excavator.dustSpawnL.getWorldPosition(_dustPosL);
            excavator.dustSpawnR.getWorldPosition(_dustPosR);
            spawnDust(_dustPosL);
            spawnDust(_dustPosR);
        }
    } else {
        _dustTimer = 0;
    }

    // ── Moteur ──
    updateMotor(Math.min(1, Math.abs(inp.fwd) + Math.abs(inp.rot) * 0.4));

    // ── Klaxon — one-shot par pression ──
    if (inp.horn && !_hornWasActive) playHorn();
    _hornWasActive = inp.horn;

    // ── Flammes ──
    if (inp.fire) {
        startFlame();
        _flameTimer += dt;
        while (_flameTimer >= FLAME_INTERVAL) {
            _flameTimer -= FLAME_INTERVAL;
            for (let f = 0; f < 4; f++) spawnFlame(excavator.flameSpawn);
        }
    } else {
        stopFlame();
        _flameTimer = 0;
    }

    updateAllParticles(dt);
    updateCharacters(dt, excavator.group.position);
    updateHUD();

    updateArm(dt, inp);
    updateCamera(dt, inp.fwd, inp.rot);
}

function updateArm(dt: number, inp: Inputs): void {
    excavator.boomPivot.rotation.x  = THREE.MathUtils.clamp(excavator.boomPivot.rotation.x  - inp.boomUp   * ARM_SPEED * dt, -1.2,  0.3);
    excavator.stickPivot.rotation.x = THREE.MathUtils.clamp(excavator.stickPivot.rotation.x + inp.stickExt * ARM_SPEED * dt,  0,    1.4);
    excavator.godetPivot.rotation.x = THREE.MathUtils.clamp(excavator.godetPivot.rotation.x + inp.godetRot * ARM_SPEED * dt, -1.0,  0.8);
}

function updateCamera(dt: number, fwd: number, rot: number): void {
    _camDelta.copy(excavator.group.position).sub(_prevExcPos);
    camera.position.add(_camDelta);
    _prevExcPos.copy(excavator.group.position);
    if (Math.abs(fwd) > 0.05 || Math.abs(rot) > 0.05) {
        _camOffset.set(0, 7, -20).applyAxisAngle(_worldUp, heading);
        _camDesired.copy(excavator.group.position).add(_camOffset);
        camera.position.lerp(_camDesired, expDecay(1.5, dt));
    }
    _lookAtTarget.copy(excavator.group.position);
    _lookAtTarget.y += 1.5;
    _camLookAt.lerp(_lookAtTarget, expDecay(8, dt));
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

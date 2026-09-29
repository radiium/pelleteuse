import * as THREE from 'three';
import { excavator } from './excavator';
import type { Inputs } from './input';
import { BORDER_START, sampleHeight, TERRAIN_SIZE } from './terrain';
import { spawnDust, spawnFlame } from './particles';
import { playHorn, playJump, playLand, startFlame, stopFlame, suspendAudio, updateMotor } from './sounds';
import { expDecay, UP } from './utils';

// Contrôleur de la pelleteuse : déplacement, saut, inclinaison, bras et effets (poussière, flammes, sons)

const SPEED             = 8;     // vitesse d'avance (u/s)
const TURN              = 1.8;   // vitesse de rotation (rad/s)
const ARM_SPEED         = 1.2;   // vitesse des articulations du bras (rad/s)
const JUMP_FORCE        = 9;
const JUMP_GRAVITY      = 24;
const SLOPE_SAMPLE_DIST = 1.5;   // écart d'échantillonnage pour la normale du terrain
const DUST_INTERVAL     = 0.06;  // s entre deux bouffées de poussière
const FLAME_INTERVAL    = 0.03;  // s entre deux salves de flammes
const INTRO_FLAMES      = 0.7;   // durée de la rafale de flammes au démarrage (s)

const _pos = excavator.group.position;

let _heading         = 0;
let _velY            = 0;
let _onGround        = true;
let _dustTimer       = 0;
let _flameTimer      = 0;
let _introFlameTimer = 0;
let _hornWasActive   = false;
const _slopeQuat     = new THREE.Quaternion();

// ── Vecteurs/quaternions pré-alloués (zéro allocation par frame) ──────────────
const _dir             = new THREE.Vector3();
const _vRight          = new THREE.Vector3();
const _vFwd            = new THREE.Vector3();
const _terrainNormal   = new THREE.Vector3();
const _targetSlopeQuat = new THREE.Quaternion();
const _headingQuat     = new THREE.Quaternion();
const _dustPosL        = new THREE.Vector3();
const _dustPosR        = new THREE.Vector3();

export function getHeading(): number { return _heading; }

/** Rafale de flammes + klaxon au lancement d'une partie. */
export function playIntro(): void {
    playHorn();
    _introFlameTimer = INTRO_FLAMES;
}

/** Coupe les sons continus (pause). */
export function silencePlayer(): void {
    stopFlame();
    suspendAudio();
}

export function resetPlayer(): void {
    stopFlame();
    _heading = 0;
    _velY = 0;
    _onGround = true;
    _dustTimer = _flameTimer = _introFlameTimer = 0;
    _slopeQuat.identity();
    excavator.group.quaternion.identity();
    _pos.set(0, sampleHeight(0, 0), 0);
    excavator.resetArm();
}

export function updatePlayer(dt: number, inp: Inputs): void {
    updateMovement(dt, inp);
    updateJump(dt, inp.jump);
    updateSlope(dt);
    excavator.animateTracks(inp.fwd * SPEED * dt * 0.5);
    excavator.moveArm(-inp.boomUp * ARM_SPEED * dt, inp.stickExt * ARM_SPEED * dt, inp.godetRot * ARM_SPEED * dt);
    updateEffects(dt, inp);
}

// Avance / tourne, avec ralentissement en approchant des collines de bordure
function updateMovement(dt: number, inp: Inputs): void {
    const half      = TERRAIN_SIZE / 2;
    const slowStart = half * BORDER_START;
    const slowEnd   = half * 0.93;
    // Distance « carrée » : même mesure que les collines de bordure du terrain
    const ax   = Math.abs(_pos.x);
    const az   = Math.abs(_pos.z);
    const edge = Math.max(ax, az);
    // Composante du cap vers le bord le plus proche
    const outwardDot = ax > az
        ? Math.sin(_heading) * Math.sign(_pos.x)
        : Math.cos(_heading) * Math.sign(_pos.z);
    // Freine selon le sens réel du déplacement (marche arrière comprise)
    const movingOut = outwardDot * Math.sign(inp.fwd) > 0;
    const speedMult = edge > slowStart && movingOut
        ? Math.max(0.08, 1 - (edge - slowStart) / (slowEnd - slowStart) * 0.92)
        : 1.0;

    _heading += inp.rot * TURN * dt;
    _dir.set(Math.sin(_heading), 0, Math.cos(_heading));
    _pos.addScaledVector(_dir, inp.fwd * SPEED * speedMult * dt);

    // Limite dure : on ne dépasse jamais slowEnd
    _pos.x = THREE.MathUtils.clamp(_pos.x, -slowEnd, slowEnd);
    _pos.z = THREE.MathUtils.clamp(_pos.z, -slowEnd, slowEnd);
}

function updateJump(dt: number, jump: boolean): void {
    const h = sampleHeight(_pos.x, _pos.z);
    if (_onGround && jump) {
        _velY     = JUMP_FORCE;
        _onGround = false;
        playJump();
    }
    if (_onGround) {
        _pos.y = h;
        return;
    }
    _velY  -= JUMP_GRAVITY * dt;
    _pos.y += _velY * dt;
    if (_pos.y <= h) {
        _pos.y    = h;
        _velY     = 0;
        _onGround = true;
        playLand();
    }
}

// Inclinaison selon la pente du terrain, lissée dans le temps
function updateSlope(dt: number): void {
    const h  = sampleHeight(_pos.x, _pos.z);
    const hR = sampleHeight(_pos.x + SLOPE_SAMPLE_DIST, _pos.z);
    const hF = sampleHeight(_pos.x, _pos.z + SLOPE_SAMPLE_DIST);
    _vRight.set(SLOPE_SAMPLE_DIST, hR - h, 0);
    _vFwd.set(0, hF - h, SLOPE_SAMPLE_DIST);
    _terrainNormal.crossVectors(_vFwd, _vRight).normalize();
    _targetSlopeQuat.setFromUnitVectors(UP, _terrainNormal);
    _slopeQuat.slerp(_targetSlopeQuat, expDecay(5, dt));
    _headingQuat.setFromAxisAngle(UP, _heading);
    excavator.group.quaternion.copy(_slopeQuat).multiply(_headingQuat);
}

function updateEffects(dt: number, inp: Inputs): void {
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
    _introFlameTimer = Math.max(0, _introFlameTimer - dt);
    if (inp.fire || _introFlameTimer > 0) {
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
}

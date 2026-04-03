import * as THREE from 'three';
import { scene, renderer, camera, controls } from './scene';
import './lights';
import { terrainGeo, sampleHeight } from './terrain';
import { excavator, boomPivot, stickPivot, godetPivot, animateTracks } from './excavator';
import { keys, getGamepad, deadzone } from './input';

const timer = new THREE.Timer();
const SPEED = 5;
const TURN = 1.8;
const ARM_SPEED = 1.2;

let heading = 0;
const slopeQuat = new THREE.Quaternion();
const _worldUp = new THREE.Vector3(0, 1, 0);

function update(dt: number): void {
    const gp = getGamepad();

    // Axes manette
    const gpLX = gp ? deadzone(gp.axes[0]) : 0;
    const gpLY = gp ? deadzone(gp.axes[1]) : 0;
    const gpRX = gp ? deadzone(gp.axes[2]) : 0;
    const gpRY = gp ? deadzone(gp.axes[3]) : 0;

    // ── Déplacement ──
    const fwd =
        (keys['KeyZ'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - gpLY;
    const rot =
        (keys['KeyQ'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) + gpLX;

    heading += rot * TURN * dt;
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    excavator.position.addScaledVector(dir, fwd * SPEED * dt);

    // Coller au terrain
    const pos = terrainGeo.attributes.position;
    const h = sampleHeight(excavator.position.x, excavator.position.z, pos);
    excavator.position.y = h;

    // Inclinaison selon la pente du terrain
    const sd = 1.5;
    const hR = sampleHeight(excavator.position.x + sd, excavator.position.z, pos);
    const hF = sampleHeight(excavator.position.x, excavator.position.z + sd, pos);
    const vRight = new THREE.Vector3(sd, hR - h, 0);
    const vFwd = new THREE.Vector3(0, hF - h, sd);
    const terrainNormal = new THREE.Vector3().crossVectors(vFwd, vRight).normalize();
    const targetSlopeQuat = new THREE.Quaternion().setFromUnitVectors(_worldUp, terrainNormal);
    slopeQuat.slerp(targetSlopeQuat, 1 - Math.exp(-8 * dt));

    // Orientation finale = inclinaison terrain × cap
    excavator.quaternion.copy(slopeQuat).multiply(
        new THREE.Quaternion().setFromAxisAngle(_worldUp, heading)
    );

    // Chenilles : animer la rotation des roues selon la vitesse
    animateTracks(fwd * SPEED * dt * 0.5);

    // ── Bras ──
    const boomUp =
        (keys['KeyI'] ? 1 : 0) -
        (keys['KeyK'] ? 1 : 0) +
        (gp ? (gp.buttons[12]?.pressed ? 1 : gp.buttons[13]?.pressed ? -1 : 0) : 0);
    const stickExt = (keys['KeyJ'] ? 1 : 0) - (keys['KeyL'] ? 1 : 0) - gpRX;
    const godetRot = (keys['KeyU'] ? 1 : 0) - (keys['KeyO'] ? 1 : 0) - gpRY;

    boomPivot.rotation.x = THREE.MathUtils.clamp(boomPivot.rotation.x - boomUp * ARM_SPEED * dt, -1.2, 0.3);
    stickPivot.rotation.x = THREE.MathUtils.clamp(
        stickPivot.rotation.x + stickExt * ARM_SPEED * dt,
        -0.2,
        1.4
    );
    godetPivot.rotation.x = THREE.MathUtils.clamp(
        godetPivot.rotation.x + godetRot * ARM_SPEED * dt,
        -1.0,
        0.8
    );

    // Caméra suit la pelleteuse
    controls.target.lerp(excavator.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.08);
    controls.update();
}

function animate(): void {
    requestAnimationFrame(animate);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    update(dt);
    renderer.render(scene, camera);
}

animate();

import * as THREE from 'three';
import { scene, renderer, camera, controls } from './scene';
import './lights';
import { terrainGeo, sampleHeight, rocks } from './terrain';
import { excavator, boomPivot, stickPivot, godetPivot, animateTracks, flameSpawn } from './excavator';
import { keys, getGamepad, deadzone } from './input';

const timer = new THREE.Timer();
const SPEED = 5;
const TURN = 1.8;
const ARM_SPEED = 1.2;

let heading = 0;
const slopeQuat = new THREE.Quaternion();
const _worldUp = new THREE.Vector3(0, 1, 0);

// ── Explosion de rochers ──
interface Fragment {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    angVel: THREE.Vector3;
    age: number;
    maxAge: number;
    initialScale: number;
}
const fragments: Fragment[] = [];
const _fragGeo = new THREE.IcosahedronGeometry(0.1, 0);
const _gravity = new THREE.Vector3(0, -12, 0);

function explodeRock(position: THREE.Vector3, radius: number): void {
    const count = 6 + Math.round(radius * 8);
    for (let i = 0; i < count; i++) {
        const scale = radius * (4.0 + Math.random() * 8);
        const mesh = new THREE.Mesh(
            _fragGeo,
            new THREE.MeshLambertMaterial({ color: 0x7a7060 })
        );
        mesh.scale.setScalar(scale);
        mesh.position.copy(position);
        scene.add(mesh);

        const speed = 3 + Math.random() * 4;
        const theta = Math.random() * Math.PI * 2;
        const upBias = 5 + Math.random() * 4;
        fragments.push({
            mesh,
            vel: new THREE.Vector3(
                Math.cos(theta) * speed,
                upBias,
                Math.sin(theta) * speed
            ),
            angVel: new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12
            ),
            age: 0,
            maxAge: 0.5 + Math.random() * 0.4,
            initialScale: scale,
        });
    }
}

function updateFragments(dt: number): void {
    for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i];
        f.age += dt;
        f.vel.addScaledVector(_gravity, dt);
        f.mesh.position.addScaledVector(f.vel, dt);
        f.mesh.rotation.x += f.angVel.x * dt;
        f.mesh.rotation.y += f.angVel.y * dt;
        f.mesh.rotation.z += f.angVel.z * dt;
        f.mesh.scale.setScalar(f.initialScale * (1 - f.age / f.maxAge));
        if (f.age >= f.maxAge) {
            scene.remove(f.mesh);
            fragments.splice(i, 1);
        }
    }
}

// ── Flammes ──
interface Flame {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    age: number;
    maxAge: number;
    initialScale: number;
}
const flames: Flame[] = [];
const _flameGeo = new THREE.IcosahedronGeometry(0.07, 0);
const _flameMats = [
    new THREE.MeshBasicMaterial({ color: 0xff3300 }),
    new THREE.MeshBasicMaterial({ color: 0xff8800 }),
    new THREE.MeshBasicMaterial({ color: 0xffdd00 }),
];
const _flameSpawnPos = new THREE.Vector3();
let _flameTimer = 0;

function spawnFlame(): void {
    flameSpawn.getWorldPosition(_flameSpawnPos);
    const scale = 2.0 + Math.random() * 2.0;
    const mat = _flameMats[Math.floor(Math.random() * _flameMats.length)];
    const mesh = new THREE.Mesh(_flameGeo, mat);
    mesh.scale.setScalar(scale);
    mesh.position.copy(_flameSpawnPos);
    scene.add(mesh);
    flames.push({
        mesh,
        vel: new THREE.Vector3(
            (Math.random() - 0.5) * 5.0,
            3 + Math.random() * 3,
            (Math.random() - 0.5) * 5.0
        ),
        age: 0,
        maxAge: 0.2 + Math.random() * 0.25,
        initialScale: scale,
    });
}

function updateFlames(dt: number): void {
    for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i];
        f.age += dt;
        f.vel.x *= 0.92;
        f.vel.z *= 0.92;
        f.mesh.position.addScaledVector(f.vel, dt);
        f.mesh.scale.setScalar(f.initialScale * (1 - f.age / f.maxAge));
        if (f.age >= f.maxAge) {
            scene.remove(f.mesh);
            flames.splice(i, 1);
        }
    }
}

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
    slopeQuat.slerp(targetSlopeQuat, 1 - Math.exp(-5 * dt));

    // Orientation finale = inclinaison terrain × cap
    excavator.quaternion.copy(slopeQuat).multiply(
        new THREE.Quaternion().setFromAxisAngle(_worldUp, heading)
    );

    // Chenilles : animer la rotation des roues selon la vitesse
    animateTracks(fwd * SPEED * dt * 0.5);

    // ── Collision rochers ──
    for (let i = rocks.length - 1; i >= 0; i--) {
        const rock = rocks[i];
        const dx = excavator.position.x - rock.mesh.position.x;
        const dz = excavator.position.z - rock.mesh.position.z;
        const collisionR = rock.radius + 1.2;
        if (dx * dx + dz * dz < collisionR * collisionR) {
            scene.remove(rock.mesh);
            explodeRock(rock.mesh.position, rock.radius);
            rocks.splice(i, 1);
        }
    }
    updateFragments(dt);

    // ── Flammes (F / bouton 0) ──
    const fireActive = keys['KeyF'] || (gp?.buttons[0]?.pressed ?? false);
    if (fireActive) {
        _flameTimer += dt;
        while (_flameTimer >= 0.03) {
            _flameTimer -= 0.03;
            for (let f = 0; f < 4; f++) spawnFlame();
        }
    } else {
        _flameTimer = 0;
    }
    updateFlames(dt);

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
        0,
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

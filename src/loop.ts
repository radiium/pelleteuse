import * as THREE from 'three';
import {
    animateTracks,
    boomPivot,
    dustSpawnL,
    dustSpawnR,
    excavator,
    flameSpawn,
    godetPivot,
    stickPivot
} from './excavator';
import { deadzone, getGamepad, keys } from './input';
import './lights';
import { camera, controls, renderer, scene } from './scene';
import { barrels, rocks, sampleHeight, terrainGeo, trees } from './terrain';

const timer = new THREE.Timer();
const SPEED = 8;
const TURN = 1.8;
const ARM_SPEED = 1.2;

let heading = 0;
const slopeQuat = new THREE.Quaternion();
const _worldUp = new THREE.Vector3(0, 1, 0);

// ── Chase cam ──
controls.enabled = false;
const _camLookAt  = new THREE.Vector3();
const _prevExcPos = new THREE.Vector3();

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
        const mesh = new THREE.Mesh(_fragGeo, new THREE.MeshLambertMaterial({ color: 0x7a7060 }));
        mesh.scale.setScalar(scale);
        mesh.position.copy(position);
        scene.add(mesh);

        const speed = 3 + Math.random() * 4;
        const theta = Math.random() * Math.PI * 2;
        const upBias = 5 + Math.random() * 4;
        fragments.push({
            mesh,
            vel: new THREE.Vector3(Math.cos(theta) * speed, upBias, Math.sin(theta) * speed),
            angVel: new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12
            ),
            age: 0,
            maxAge: 0.5 + Math.random() * 0.4,
            initialScale: scale
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
    new THREE.MeshBasicMaterial({ color: 0xffdd00 })
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
        initialScale: scale
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

// ── Poussière chenilles ──
const dusts: Flame[] = [];
const _dustGeo = new THREE.SphereGeometry(0.1, 4, 3);
const _dustMats = [
    new THREE.MeshBasicMaterial({ color: 0x7a6348 }),
    new THREE.MeshBasicMaterial({ color: 0x6e5a40 }),
    new THREE.MeshBasicMaterial({ color: 0x857060 })
];
const _dustPosL = new THREE.Vector3();
const _dustPosR = new THREE.Vector3();
let _dustTimer = 0;

function spawnDust(pos: THREE.Vector3): void {
    const scale = 1.0 + Math.random() * 1.5;
    const mesh = new THREE.Mesh(_dustGeo, _dustMats[Math.floor(Math.random() * 3)]);
    mesh.scale.setScalar(0.01);
    mesh.position.copy(pos);
    scene.add(mesh);
    dusts.push({
        mesh,
        vel: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0.4 + Math.random() * 0.6,
            (Math.random() - 0.5) * 2
        ),
        age: 0,
        maxAge: 0.7 + Math.random() * 0.8,
        initialScale: scale
    });
}

function updateDusts(dt: number): void {
    for (let i = dusts.length - 1; i >= 0; i--) {
        const d = dusts[i];
        d.age += dt;
        d.vel.x *= 0.96;
        d.vel.z *= 0.96;
        d.mesh.position.addScaledVector(d.vel, dt);
        const t = d.age / d.maxAge;
        // Gonfle jusqu'à 40% de vie, puis se dissipe
        d.mesh.scale.setScalar(d.initialScale * (t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6));
        if (d.age >= d.maxAge) {
            scene.remove(d.mesh);
            dusts.splice(i, 1);
        }
    }
}

// ── Barils explosifs ──
const _smokeMat = new THREE.MeshBasicMaterial({ color: 0x444444 });

function explodeBarrel(position: THREE.Vector3): void {
    // Boule de feu
    for (let i = 0; i < 22; i++) {
        const scale = 2.0 + Math.random() * 3.0;
        const mat = _flameMats[Math.floor(Math.random() * _flameMats.length)];
        const mesh = new THREE.Mesh(_flameGeo, mat);
        mesh.scale.setScalar(scale);
        mesh.position.copy(position);
        scene.add(mesh);
        const speed = 5 + Math.random() * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        flames.push({
            mesh,
            vel: new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.abs(Math.cos(phi)) * speed + 3,
                Math.sin(phi) * Math.sin(theta) * speed
            ),
            age: 0,
            maxAge: 0.5 + Math.random() * 0.5,
            initialScale: scale
        });
    }
    // Fumée noire
    for (let i = 0; i < 10; i++) {
        const scale = 2.5 + Math.random() * 2.0;
        const mesh = new THREE.Mesh(_dustGeo, _smokeMat);
        mesh.scale.setScalar(0.01);
        mesh.position.copy(position);
        scene.add(mesh);
        dusts.push({
            mesh,
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                4 + Math.random() * 4,
                (Math.random() - 0.5) * 2
            ),
            age: 0,
            maxAge: 1.2 + Math.random() * 0.8,
            initialScale: scale
        });
    }
}

// ── Arbres ──
interface FallingTree {
    group: THREE.Group;
    fallAxis: THREE.Vector3;
    angle: number;
}
const fallingTrees: FallingTree[] = [];

function updateFallingTrees(dt: number): void {
    for (let i = fallingTrees.length - 1; i >= 0; i--) {
        const t = fallingTrees[i];
        const delta = 2.0 * dt;
        t.angle += delta;
        t.group.rotateOnWorldAxis(t.fallAxis, delta);
        if (t.angle >= Math.PI / 2) {
            scene.remove(t.group);
            fallingTrees.splice(i, 1);
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
        (keys['KeyZ'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) + gpLY;
    const rot =
        (keys['KeyQ'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - gpLX;

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
    excavator.quaternion.copy(slopeQuat).multiply(new THREE.Quaternion().setFromAxisAngle(_worldUp, heading));

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

    // ── Poussière chenilles ──
    if (Math.abs(fwd) > 0.05 || Math.abs(rot) > 0.05) {
        _dustTimer += dt;
        while (_dustTimer >= 0.06) {
            _dustTimer -= 0.06;
            dustSpawnL.getWorldPosition(_dustPosL);
            dustSpawnR.getWorldPosition(_dustPosR);
            spawnDust(_dustPosL);
            spawnDust(_dustPosR);
        }
    } else {
        _dustTimer = 0;
    }
    updateDusts(dt);

    // ── Collision barils ──
    for (let i = barrels.length - 1; i >= 0; i--) {
        const b = barrels[i];
        const dx = excavator.position.x - b.obj.position.x;
        const dz = excavator.position.z - b.obj.position.z;
        if (dx * dx + dz * dz < (b.radius + 1.2) ** 2) {
            scene.remove(b.obj);
            explodeBarrel(b.obj.position);
            barrels.splice(i, 1);
        }
    }

    // ── Collision arbres ──
    for (let i = trees.length - 1; i >= 0; i--) {
        const tree = trees[i];
        const dx = excavator.position.x - tree.group.position.x;
        const dz = excavator.position.z - tree.group.position.z;
        if (dx * dx + dz * dz < (tree.radius + 1.3) ** 2) {
            const fallDir = new THREE.Vector3(-dx, 0, -dz).normalize();
            const fallAxis = new THREE.Vector3().crossVectors(_worldUp, fallDir).normalize();
            fallingTrees.push({ group: tree.group, fallAxis, angle: 0 });
            trees.splice(i, 1);
        }
    }
    updateFallingTrees(dt);

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
    stickPivot.rotation.x = THREE.MathUtils.clamp(stickPivot.rotation.x + stickExt * ARM_SPEED * dt, 0, 1.4);
    godetPivot.rotation.x = THREE.MathUtils.clamp(
        godetPivot.rotation.x + godetRot * ARM_SPEED * dt,
        -1.0,
        0.8
    );

    // ── Chase cam ──
    // Translate la caméra avec la pelleteuse (pas de lag de position)
    camera.position.add(excavator.position.clone().sub(_prevExcPos));
    _prevExcPos.copy(excavator.position);
    // Quand on bouge : dérive doucement derrière. À l'arrêt : reste en place.
    if (Math.abs(fwd) > 0.05 || Math.abs(rot) > 0.05) {
        const desired = excavator.position.clone().add(
            new THREE.Vector3(0, 7, -20).applyAxisAngle(_worldUp, heading)
        );
        camera.position.lerp(desired, 1 - Math.exp(-1.5 * dt));
    }
    _camLookAt.lerp(excavator.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.exp(-8 * dt));
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

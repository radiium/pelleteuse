import * as THREE from 'three';
import { scene } from './scene';
import { sampleHeight, TERRAIN_SIZE, terrainGeo } from './terrain';
import { explodeBarrel, explodeRock } from './particles';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RockObj   { mesh: THREE.Mesh;    radius: number }
export interface BarrelObj { obj: THREE.Object3D; radius: number }
export interface TreeObj   { group: THREE.Group;  radius: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomPos(minDist: number): [number, number] {
    let x: number, z: number;
    do {
        x = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
        z = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    } while (Math.sqrt(x * x + z * z) < minDist);
    return [x, z];
}

// ── Rochers ───────────────────────────────────────────────────────────────────

export const rocks: RockObj[] = [];

for (let i = 0; i < 20; i++) {
    const r = 0.3 + Math.random() * 0.9;
    const geo = new THREE.DodecahedronGeometry(r, 0);
    geo.rotateY(Math.random() * Math.PI);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a7060 });
    const rock = new THREE.Mesh(geo, mat);
    rock.castShadow = true;
    const [rx, rz] = randomPos(5);
    rock.position.set(rx, sampleHeight(rx, rz, terrainGeo.attributes.position) + r * 0.5, rz);
    scene.add(rock);
    rocks.push({ mesh: rock, radius: r });
}

// ── Barils ────────────────────────────────────────────────────────────────────

export const barrels: BarrelObj[] = [];

const MAT_BARREL = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
const MAT_BAND   = new THREE.MeshLambertMaterial({ color: 0x111111 });

for (let i = 0; i < 10; i++) {
    const [bx, bz] = randomPos(10);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 10), MAT_BARREL);
    body.castShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.10, 10), MAT_BAND);
    band.position.y = 0.12;
    g.add(band);
    const bh = sampleHeight(bx, bz, terrainGeo.attributes.position);
    g.position.set(bx, bh + 0.375, bz);
    scene.add(g);
    barrels.push({ obj: g, radius: 0.32 });
}

// ── Arbres ────────────────────────────────────────────────────────────────────

export const trees: TreeObj[] = [];

const MAT_TRUNK  = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const MAT_LEAVES = new THREE.MeshLambertMaterial({ color: 0x2d6e1a });

for (let i = 0; i < 25; i++) {
    const [tx, tz] = randomPos(10);
    const g = new THREE.Group();
    const trunkH = 2.0 + Math.random() * 1.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 7), MAT_TRUNK);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 7), MAT_LEAVES);
    cone1.position.y = trunkH + 1.0;
    cone1.castShadow = true;
    g.add(cone1);
    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 7), MAT_LEAVES);
    cone2.position.y = trunkH + 2.4;
    cone2.castShadow = true;
    g.add(cone2);
    const th = sampleHeight(tx, tz, terrainGeo.attributes.position);
    g.position.set(tx, th, tz);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
    trees.push({ group: g, radius: 0.35 });
}

// ── Arbres qui tombent ────────────────────────────────────────────────────────

interface FallingTree { group: THREE.Group; fallAxis: THREE.Vector3; angle: number }
const fallingTrees: FallingTree[] = [];
const _worldUp = new THREE.Vector3(0, 1, 0);

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

// ── Collisions ────────────────────────────────────────────────────────────────

export function checkCollisions(excavatorPos: THREE.Vector3, dt: number): void {
    for (let i = rocks.length - 1; i >= 0; i--) {
        const rock = rocks[i];
        const dx = excavatorPos.x - rock.mesh.position.x;
        const dz = excavatorPos.z - rock.mesh.position.z;
        if (dx * dx + dz * dz < (rock.radius + 1.2) ** 2) {
            scene.remove(rock.mesh);
            explodeRock(rock.mesh.position, rock.radius);
            rocks.splice(i, 1);
        }
    }

    for (let i = barrels.length - 1; i >= 0; i--) {
        const b = barrels[i];
        const dx = excavatorPos.x - b.obj.position.x;
        const dz = excavatorPos.z - b.obj.position.z;
        if (dx * dx + dz * dz < (b.radius + 1.2) ** 2) {
            scene.remove(b.obj);
            explodeBarrel(b.obj.position);
            barrels.splice(i, 1);
        }
    }

    for (let i = trees.length - 1; i >= 0; i--) {
        const tree = trees[i];
        const dx = excavatorPos.x - tree.group.position.x;
        const dz = excavatorPos.z - tree.group.position.z;
        if (dx * dx + dz * dz < (tree.radius + 1.3) ** 2) {
            const fallDir = new THREE.Vector3(-dx, 0, -dz).normalize();
            const fallAxis = new THREE.Vector3().crossVectors(_worldUp, fallDir).normalize();
            fallingTrees.push({ group: tree.group, fallAxis, angle: 0 });
            trees.splice(i, 1);
        }
    }

    updateFallingTrees(dt);
}

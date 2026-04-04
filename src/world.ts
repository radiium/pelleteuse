import * as THREE from 'three';
import { scene } from './scene';
import { sampleHeight, TERRAIN_SIZE, terrainGeo } from './terrain';
import { explodeBarrel, explodeRock } from './particles';
import { BARREL_COUNT, ROCK_COUNT, TREE_COUNT } from './config';

// ── Interface commune ─────────────────────────────────────────────────────────

interface Collidable {
    readonly position: THREE.Vector3;
    readonly radius:   number;
    readonly isAlive:  boolean;
    onCollide(excavatorPos: THREE.Vector3, dt: number): void;
    update(dt: number): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _posAttr = terrainGeo.attributes.position;

function randomPos(minDist: number): [number, number] {
    let x: number, z: number;
    do {
        x = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
        z = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    } while (Math.sqrt(x * x + z * z) < minDist);
    return [x, z];
}

// ── Rock ──────────────────────────────────────────────────────────────────────

class Rock implements Collidable {
    readonly mesh:   THREE.Mesh;
    readonly radius: number;
    private _alive = true;

    get position() { return this.mesh.position; }
    get isAlive()  { return this._alive; }

    constructor() {
        const r = 0.3 + Math.random() * 0.9;
        this.radius = r;
        const geo = new THREE.DodecahedronGeometry(r, 0);
        geo.rotateY(Math.random() * Math.PI);
        this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x7a7060 }));
        this.mesh.castShadow = true;
        const [x, z] = randomPos(5);
        this.mesh.position.set(x, sampleHeight(x, z, _posAttr) + r * 0.5, z);
        scene.add(this.mesh);
    }

    onCollide(_excavatorPos: THREE.Vector3, _dt: number): void {
        this.mesh.parent?.remove(this.mesh);
        explodeRock(this.mesh.position, this.radius);
        this._alive = false;
    }

    update(_dt: number): void {}
}

// ── Barrel ────────────────────────────────────────────────────────────────────

const MAT_BARREL = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
const MAT_BAND   = new THREE.MeshLambertMaterial({ color: 0x111111 });

class Barrel implements Collidable {
    readonly obj:    THREE.Group;
    readonly radius = 0.32;
    private _alive  = true;

    get position() { return this.obj.position; }
    get isAlive()  { return this._alive; }

    constructor() {
        this.obj = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 10), MAT_BARREL);
        body.castShadow = true;
        this.obj.add(body);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.10, 10), MAT_BAND);
        band.position.y = 0.12;
        this.obj.add(band);
        const [x, z] = randomPos(10);
        this.obj.position.set(x, sampleHeight(x, z, _posAttr) + 0.375, z);
        scene.add(this.obj);
    }

    onCollide(_excavatorPos: THREE.Vector3, _dt: number): void {
        this.obj.parent?.remove(this.obj);
        explodeBarrel(this.obj.position);
        this._alive = false;
    }

    update(_dt: number): void {}
}

// ── Tree ──────────────────────────────────────────────────────────────────────

const MAT_TRUNK  = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const MAT_LEAVES = new THREE.MeshLambertMaterial({ color: 0x2d6e1a });
const _worldUp   = new THREE.Vector3(0, 1, 0);

class Tree implements Collidable {
    readonly group:  THREE.Group;
    readonly radius = 0.45; // 0.35 + 0.1 marge absorbée
    private _fallAxis:  THREE.Vector3 | null = null;
    private _fallAngle = 0;

    get position() { return this.group.position; }
    get isAlive()  { return !(this._fallAxis === null && this._fallAngle > 0); }

    constructor() {
        this.group = new THREE.Group();
        const trunkH = 2.0 + Math.random() * 1.5;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 7), MAT_TRUNK);
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        this.group.add(trunk);
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 7), MAT_LEAVES);
        cone1.position.y = trunkH + 1.0;
        cone1.castShadow = true;
        this.group.add(cone1);
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 7), MAT_LEAVES);
        cone2.position.y = trunkH + 2.4;
        cone2.castShadow = true;
        this.group.add(cone2);
        const [x, z] = randomPos(10);
        this.group.position.set(x, sampleHeight(x, z, _posAttr), z);
        this.group.rotation.y = Math.random() * Math.PI * 2;
        scene.add(this.group);
    }

    onCollide(excavatorPos: THREE.Vector3, _dt: number): void {
        if (this._fallAxis !== null) return; // déjà en train de tomber
        const dx = excavatorPos.x - this.group.position.x;
        const dz = excavatorPos.z - this.group.position.z;
        const fallDir = new THREE.Vector3(-dx, 0, -dz).normalize();
        this._fallAxis = new THREE.Vector3().crossVectors(_worldUp, fallDir).normalize();
        this._fallAngle = 0.001; // > 0 pour activer isAlive tracking
    }

    update(dt: number): void {
        if (this._fallAxis === null) return;
        const delta = 2.0 * dt;
        this._fallAngle += delta;
        this.group.rotateOnWorldAxis(this._fallAxis, delta);
        if (this._fallAngle >= Math.PI / 2) {
            this.group.parent?.remove(this.group);
            this._fallAxis = null;
        }
    }
}

// ── Entités + collisions ──────────────────────────────────────────────────────

const entities: Collidable[] = [];

for (let i = 0; i < ROCK_COUNT;   i++) entities.push(new Rock());
for (let i = 0; i < BARREL_COUNT; i++) entities.push(new Barrel());
for (let i = 0; i < TREE_COUNT;   i++) entities.push(new Tree());

export function checkCollisions(excavatorPos: THREE.Vector3, dt: number): void {
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        e.update(dt);

        if (!e.isAlive) { entities.splice(i, 1); continue; }

        const dx = excavatorPos.x - e.position.x;
        const dz = excavatorPos.z - e.position.z;
        if (dx * dx + dz * dz < (e.radius + 1.2) ** 2) {
            e.onCollide(excavatorPos, dt);
        }
    }
}

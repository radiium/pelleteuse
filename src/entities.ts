import * as THREE from 'three';
import { scene } from './scene';
import { randomPos, sampleHeight } from './terrain';
import { explodeBarrel, explodeRock } from './particles';
import { playExplosion, playRockBreak, playTreeCrack } from './sounds';
import { disposeObject, UP } from './utils';
import { score } from './score';
import { Character } from './characters';

const ROCK_COUNT      = 55;
const BARREL_COUNT    = 25;
const TREE_COUNT      = 65;
const CHARACTER_COUNT = 12;
const EXCAVATOR_RADIUS = 1.2; // rayon de collision de la pelleteuse

// ── Interface commune ─────────────────────────────────────────────────────────

export interface Collidable {
    readonly object:   THREE.Object3D;
    readonly position: THREE.Vector3;
    readonly radius:   number;
    readonly isAlive:  boolean; // false → retirée du monde et libérée
    onCollide(excavatorPos: THREE.Vector3): void;
    update?(dt: number, excavatorPos: THREE.Vector3): void;
}

// ── Rock ──────────────────────────────────────────────────────────────────────

const MAT_ROCK = new THREE.MeshLambertMaterial({ color: 0x7a7060 });

class Rock implements Collidable {
    readonly mesh:   THREE.Mesh;
    readonly radius: number;
    private _alive = true;

    get object()   { return this.mesh; }
    get position() { return this.mesh.position; }
    get isAlive()  { return this._alive; }

    constructor() {
        const r = 0.3 + Math.random() * 0.9;
        this.radius = r;
        const geo = new THREE.DodecahedronGeometry(r, 0);
        geo.rotateY(Math.random() * Math.PI);
        this.mesh = new THREE.Mesh(geo, MAT_ROCK);
        this.mesh.castShadow = true;
        const [x, z] = randomPos(5);
        this.mesh.position.set(x, sampleHeight(x, z) + r * 0.5, z);
        scene.add(this.mesh);
    }

    onCollide(): void {
        explodeRock(this.mesh.position, this.radius);
        playRockBreak();
        this._alive = false;
        score.rocks++;
    }
}

// ── Barrel ────────────────────────────────────────────────────────────────────

const MAT_BARREL = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
const MAT_BAND   = new THREE.MeshLambertMaterial({ color: 0x111111 });

class Barrel implements Collidable {
    readonly obj:    THREE.Group;
    readonly radius = 0.32;
    private _alive  = true;

    get object()   { return this.obj; }
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
        this.obj.position.set(x, sampleHeight(x, z) + 0.375, z);
        scene.add(this.obj);
    }

    onCollide(): void {
        explodeBarrel(this.obj.position);
        playExplosion();
        this._alive = false;
        score.barrels++;
    }
}

// ── Tree ──────────────────────────────────────────────────────────────────────

const MAT_TRUNK  = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const MAT_LEAVES = new THREE.MeshLambertMaterial({ color: 0x2d6e1a });

const TREE_FALL_SPEED = 2.0; // rad/s
const TREE_SINK_DELAY = 0.5; // s couché au sol avant de s'enfoncer
const TREE_SINK_TIME  = 1.0; // s pour disparaître sous le sol
const TREE_SINK_DEPTH = 1.8; // assez pour enfouir le feuillage couché

class Tree implements Collidable {
    readonly group:  THREE.Group;
    readonly radius = 0.45;
    private _state: 'standing' | 'falling' | 'sinking' | 'gone' = 'standing';
    private readonly _fallAxis = new THREE.Vector3();
    private _fallAngle = 0;
    private _sinkAge   = 0;

    get object()   { return this.group; }
    get position() { return this.group.position; }
    get isAlive()  { return this._state !== 'gone'; }

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
        this.group.position.set(x, sampleHeight(x, z), z);
        this.group.rotation.y = Math.random() * Math.PI * 2;
        scene.add(this.group);
    }

    onCollide(excavatorPos: THREE.Vector3): void {
        if (this._state !== 'standing') return;
        this._state = 'falling';
        playTreeCrack();
        score.trees++;
        // Tombe dans la direction opposée à la pelleteuse
        const fallDir = new THREE.Vector3(
            this.group.position.x - excavatorPos.x, 0, this.group.position.z - excavatorPos.z,
        ).normalize();
        this._fallAxis.crossVectors(UP, fallDir).normalize();
    }

    update(dt: number): void {
        if (this._state === 'falling') {
            // Borné pour finir exactement à plat
            const delta = Math.min(TREE_FALL_SPEED * dt, Math.PI / 2 - this._fallAngle);
            this._fallAngle += delta;
            this.group.rotateOnWorldAxis(this._fallAxis, delta);
            if (this._fallAngle >= Math.PI / 2) this._state = 'sinking';
        } else if (this._state === 'sinking') {
            // Reste couché un instant, puis s'enfonce doucement dans le sol
            this._sinkAge += dt;
            if (this._sinkAge > TREE_SINK_DELAY) {
                this.group.position.y -= (TREE_SINK_DEPTH / TREE_SINK_TIME) * dt;
            }
            if (this._sinkAge >= TREE_SINK_DELAY + TREE_SINK_TIME) this._state = 'gone';
        }
    }
}

// ── Entités + collisions ──────────────────────────────────────────────────────

const entities: Collidable[] = [];

function spawnEntities(): void {
    for (let i = 0; i < ROCK_COUNT;      i++) entities.push(new Rock());
    for (let i = 0; i < BARREL_COUNT;    i++) entities.push(new Barrel());
    for (let i = 0; i < TREE_COUNT;      i++) entities.push(new Tree());
    for (let i = 0; i < CHARACTER_COUNT; i++) entities.push(new Character());
}
spawnEntities();

// Nouvelle partie : repeuple le terrain (objets + monstres)
export function resetEntities(): void {
    for (const e of entities) disposeObject(e.object);
    entities.length = 0;
    spawnEntities();
}

// Anime les entités et résout les collisions avec la pelleteuse
export function updateEntities(dt: number, excavatorPos: THREE.Vector3): void {
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        e.update?.(dt, excavatorPos);

        const dx = excavatorPos.x - e.position.x;
        const dz = excavatorPos.z - e.position.z;
        if (e.isAlive && dx * dx + dz * dz < (e.radius + EXCAVATOR_RADIUS) ** 2) {
            e.onCollide(excavatorPos);
        }

        // Détruite, arbre enfoui ou monstre envolé : retirée de la scène et libérée
        if (!e.isAlive) {
            disposeObject(e.object);
            entities.splice(i, 1);
        }
    }
}

import * as THREE from 'three';
import { scene } from './scene';
import { randomPos, sampleHeight, TERRAIN_SIZE } from './terrain';
import { spawnConfetti } from './particles';
import { playMonster } from './sounds';
import { score } from './score';
import type { Collidable } from './entities';

// ── Constantes ────────────────────────────────────────────────────────────────

const FLEE_DIST    = 6;
const WANDER_SPEED = 1.5;
const FLEE_SPEED   = 4.5;

const BODY_MATS = [0x27ae60, 0x8e44ad, 0xc0392b, 0x16a085, 0xd35400, 0x2980b9]
    .map((color) => new THREE.MeshLambertMaterial({ color }));
const MAT_WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MAT_BLACK = new THREE.MeshBasicMaterial({ color: 0x111111 });

// ── Monstre : erre, fuit la pelleteuse, s'envole quand il est écrasé ──────────

type State = 'wandering' | 'fleeing' | 'dead';

export class Character implements Collidable {
    readonly group:  THREE.Group;
    readonly radius = 0.6;
    private legL:    THREE.Mesh;
    private legR:    THREE.Mesh;
    private state:   State   = 'wandering';
    private heading: number  = Math.random() * Math.PI * 2;
    private dirTimer: number = 0;
    private legPhase: number = 0;
    private deadAge:  number = 0;
    private vel = new THREE.Vector3();

    get object()   { return this.group; }
    get position() { return this.group.position; }
    get isAlive()  { return !(this.state === 'dead' && this.deadAge >= 1.2); }

    constructor() {
        this.group = new THREE.Group();

        const matBody = BODY_MATS[Math.floor(Math.random() * BODY_MATS.length)];

        // Corps (trapu)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.55), matBody);
        body.position.y = 0.95;
        body.castShadow = true;
        this.group.add(body);

        // Tête carrée de monstre
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.6), matBody);
        head.position.y = 1.78;
        head.castShadow = true;
        this.group.add(head);

        // Yeux (visibles depuis l'avant et l'arrière)
        const eyeGeo   = new THREE.SphereGeometry(0.11, 6, 4);
        const pupilGeo = new THREE.SphereGeometry(0.06, 5, 3);
        [-1, 1].forEach((side) => {
            const eye = new THREE.Mesh(eyeGeo, MAT_WHITE);
            eye.position.set(side * 0.16, 1.85, 0.31);
            this.group.add(eye);
            const pupil = new THREE.Mesh(pupilGeo, MAT_BLACK);
            pupil.position.set(side * 0.16, 1.85, 0.37);
            this.group.add(pupil);
        });

        // Corne
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), matBody);
        horn.position.set(0, 2.18, 0);
        this.group.add(horn);

        // Bras
        const armGeo = new THREE.BoxGeometry(0.2, 0.55, 0.2);
        const armL = new THREE.Mesh(armGeo, matBody);
        armL.position.set(-0.52, 0.95, 0);
        armL.rotation.z = 0.35;
        armL.castShadow = true;
        this.group.add(armL);
        const armR = new THREE.Mesh(armGeo, matBody);
        armR.position.set(0.52, 0.95, 0);
        armR.rotation.z = -0.35;
        armR.castShadow = true;
        this.group.add(armR);

        // Jambes
        const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        this.legL = new THREE.Mesh(legGeo, matBody);
        this.legL.position.set(-0.2, 0.35, 0);
        this.group.add(this.legL);
        this.legR = new THREE.Mesh(legGeo, matBody);
        this.legR.position.set(0.2, 0.35, 0);
        this.group.add(this.legR);

        // Position initiale : hors de la zone de départ
        const [x, z] = randomPos(12, 15);
        this.group.position.set(x, sampleHeight(x, z), z);
        this.group.rotation.y = this.heading;
        scene.add(this.group);
    }

    update(dt: number, excavatorPos: THREE.Vector3): void {
        if (this.state === 'dead') { this.updateDead(dt); return; }

        const dx   = excavatorPos.x - this.group.position.x;
        const dz   = excavatorPos.z - this.group.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Transitions d'état
        if (dist < FLEE_DIST) {
            this.state   = 'fleeing';
            this.heading = Math.atan2(-dx, -dz);
        } else {
            this.state    = 'wandering';
            this.dirTimer -= dt;
            if (this.dirTimer <= 0) {
                this.heading  += (Math.random() - 0.5) * Math.PI * 1.5;
                this.dirTimer  = 1.5 + Math.random() * 2.5;
            }
        }

        const speed = this.state === 'fleeing' ? FLEE_SPEED : WANDER_SPEED;

        // Déplacement
        let nx = this.group.position.x + Math.sin(this.heading) * speed * dt;
        let nz = this.group.position.z + Math.cos(this.heading) * speed * dt;

        // Rebond sur les bords
        const half = TERRAIN_SIZE / 2 - 3;
        // x = sin(heading), z = cos(heading) : inverser x → -h, inverser z → π - h
        if (nx < -half || nx > half) { this.heading = -this.heading;          nx = THREE.MathUtils.clamp(nx, -half, half); }
        if (nz < -half || nz > half) { this.heading = Math.PI - this.heading; nz = THREE.MathUtils.clamp(nz, -half, half); }

        this.group.position.set(nx, sampleHeight(nx, nz), nz);
        this.group.rotation.y = this.heading;

        // Animation jambes + bob
        this.legPhase      += speed * dt * 8;
        this.legL.rotation.x =  Math.sin(this.legPhase) * 0.5;
        this.legR.rotation.x = -Math.sin(this.legPhase) * 0.5;
        this.group.position.y += Math.abs(Math.sin(this.legPhase)) * 0.04;
    }

    // Écrasé
    onCollide(excavatorPos: THREE.Vector3): void {
        if (this.state === 'dead') return;
        this.state = 'dead';
        score.monsters++;
        playMonster();
        spawnConfetti(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
        const out = new THREE.Vector3(
            this.group.position.x - excavatorPos.x, 0, this.group.position.z - excavatorPos.z,
        ).normalize();
        this.vel.set(out.x * 6, 11, out.z * 6);
    }

    private updateDead(dt: number): void {
        this.deadAge += dt;

        if (this.deadAge < 0.12) {
            // Phase 1 — écrasement express
            const t = this.deadAge / 0.12;
            this.group.scale.set(1 + t * 0.8, 1 - t * 0.85, 1 + t * 0.8);
        } else {
            // Phase 2 — envol avec spin
            this.group.scale.setScalar(1);
            this.vel.y -= 18 * dt;
            this.group.position.addScaledVector(this.vel, dt);
            this.group.rotation.x += 8 * dt;
            this.group.rotation.z += 5 * dt;
        }
    }
}

import * as THREE from 'three';
import { scene } from './scene';

// ── Système de particules générique ──────────────────────────────────────────

interface Particle {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    age: number;
    maxAge: number;
    initialScale: number;
    angVel?: THREE.Vector3;
}

interface PoolConfig {
    geo: THREE.BufferGeometry;
    mats: THREE.Material[];
    gravity: number;                  // ex: 12 pour fragments, 0 pour flammes/dust
    xzDamping: number;                // ex: 0.92 flammes, 0.96 dust, 1.0 fragments
    scaleCurve: 'linear' | 'inflate'; // 'inflate' = gonfle puis rétrécit (dust)
}

class ParticlePool {
    private pool: Particle[] = [];
    private cfg: PoolConfig;

    constructor(cfg: PoolConfig) { this.cfg = cfg; }

    spawn(
        position: THREE.Vector3,
        vel: THREE.Vector3,
        scale: number,
        maxAge: number,
        angVel?: THREE.Vector3,
        matOverride?: THREE.Material
    ): void {
        const mat = matOverride ?? this.cfg.mats[Math.floor(Math.random() * this.cfg.mats.length)];
        const mesh = new THREE.Mesh(this.cfg.geo, mat);
        mesh.scale.setScalar(this.cfg.scaleCurve === 'inflate' ? 0.01 : scale);
        mesh.position.copy(position);
        scene.add(mesh);
        this.pool.push({ mesh, vel: vel.clone(), age: 0, maxAge, initialScale: scale, angVel });
    }

    update(dt: number): void {
        const { gravity, xzDamping, scaleCurve } = this.cfg;
        for (let i = this.pool.length - 1; i >= 0; i--) {
            const p = this.pool[i];
            p.age += dt;
            if (gravity > 0) p.vel.y -= gravity * dt;
            p.vel.x *= xzDamping;
            p.vel.z *= xzDamping;
            p.mesh.position.addScaledVector(p.vel, dt);
            if (p.angVel) {
                p.mesh.rotation.x += p.angVel.x * dt;
                p.mesh.rotation.y += p.angVel.y * dt;
                p.mesh.rotation.z += p.angVel.z * dt;
            }
            const t = p.age / p.maxAge;
            const s = scaleCurve === 'inflate'
                ? p.initialScale * (t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6)
                : p.initialScale * (1 - t);
            p.mesh.scale.setScalar(Math.max(0, s));
            if (p.age >= p.maxAge) {
                scene.remove(p.mesh);
                this.pool.splice(i, 1);
            }
        }
    }
}

// ── Pools instanciées ─────────────────────────────────────────────────────────

const _fragGeo  = new THREE.IcosahedronGeometry(0.1, 0);
const _flameGeo = new THREE.IcosahedronGeometry(0.07, 0);
const _dustGeo  = new THREE.SphereGeometry(0.1, 4, 3);
const _smokeMat = new THREE.MeshBasicMaterial({ color: 0x444444 });

const fragmentPool = new ParticlePool({
    geo: _fragGeo,
    mats: [new THREE.MeshLambertMaterial({ color: 0x7a7060 })],
    gravity: 12, xzDamping: 1.0, scaleCurve: 'linear',
});

const flamePool = new ParticlePool({
    geo: _flameGeo,
    mats: [
        new THREE.MeshBasicMaterial({ color: 0xff3300 }),
        new THREE.MeshBasicMaterial({ color: 0xff8800 }),
        new THREE.MeshBasicMaterial({ color: 0xffdd00 }),
    ],
    gravity: 0, xzDamping: 0.92, scaleCurve: 'linear',
});

const dustPool = new ParticlePool({
    geo: _dustGeo,
    mats: [
        new THREE.MeshBasicMaterial({ color: 0x7a6348 }),
        new THREE.MeshBasicMaterial({ color: 0x6e5a40 }),
        new THREE.MeshBasicMaterial({ color: 0x857060 }),
    ],
    gravity: 0, xzDamping: 0.96, scaleCurve: 'inflate',
});

const _confettiGeo = new THREE.BoxGeometry(0.18, 0.06, 0.12);
const confettiPool = new ParticlePool({
    geo: _confettiGeo,
    mats: [
        new THREE.MeshBasicMaterial({ color: 0xff3366 }),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
        new THREE.MeshBasicMaterial({ color: 0x33ccff }),
        new THREE.MeshBasicMaterial({ color: 0x66ff33 }),
        new THREE.MeshBasicMaterial({ color: 0xff6600 }),
        new THREE.MeshBasicMaterial({ color: 0xcc33ff }),
    ],
    gravity: 7, xzDamping: 0.97, scaleCurve: 'linear',
});

// ── API publique ──────────────────────────────────────────────────────────────

export function explodeRock(position: THREE.Vector3, radius: number): void {
    const count = 6 + Math.round(radius * 8);
    for (let i = 0; i < count; i++) {
        const scale = radius * (4.0 + Math.random() * 8);
        const speed = 3 + Math.random() * 4;
        const theta = Math.random() * Math.PI * 2;
        fragmentPool.spawn(
            position,
            new THREE.Vector3(Math.cos(theta) * speed, 5 + Math.random() * 4, Math.sin(theta) * speed),
            scale,
            0.5 + Math.random() * 0.4,
            new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12)
        );
    }
}

export function explodeBarrel(position: THREE.Vector3): void {
    for (let i = 0; i < 22; i++) {
        const speed = 5 + Math.random() * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.random() * Math.PI;
        flamePool.spawn(
            position,
            new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.abs(Math.cos(phi)) * speed + 3,
                Math.sin(phi) * Math.sin(theta) * speed
            ),
            2.0 + Math.random() * 3.0,
            0.5 + Math.random() * 0.5
        );
    }
    for (let i = 0; i < 10; i++) {
        dustPool.spawn(
            position,
            new THREE.Vector3((Math.random() - 0.5) * 2, 4 + Math.random() * 4, (Math.random() - 0.5) * 2),
            2.5 + Math.random() * 2.0,
            1.2 + Math.random() * 0.8,
            undefined,
            _smokeMat
        );
    }
}

const _flameSpawnPos = new THREE.Vector3();

export function spawnFlame(spawnPoint: THREE.Object3D): void {
    spawnPoint.getWorldPosition(_flameSpawnPos);
    flamePool.spawn(
        _flameSpawnPos,
        new THREE.Vector3((Math.random() - 0.5) * 5.0, 3 + Math.random() * 3, (Math.random() - 0.5) * 5.0),
        2.0 + Math.random() * 2.0,
        0.2 + Math.random() * 0.25
    );
}

export function spawnDust(pos: THREE.Vector3): void {
    dustPool.spawn(
        pos,
        new THREE.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 2),
        1.0 + Math.random() * 1.5,
        0.7 + Math.random() * 0.8
    );
}

export function spawnConfetti(pos: THREE.Vector3): void {
    for (let i = 0; i < 28; i++) {
        const theta = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        confettiPool.spawn(
            pos,
            new THREE.Vector3(Math.cos(theta) * speed, 5 + Math.random() * 6, Math.sin(theta) * speed),
            1.0,
            1.2 + Math.random() * 0.6,
            new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16)
        );
    }
}

export function updateAllParticles(dt: number): void {
    fragmentPool.update(dt);
    flamePool.update(dt);
    dustPool.update(dt);
    confettiPool.update(dt);
}

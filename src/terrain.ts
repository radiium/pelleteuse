import * as THREE from 'three';
import { scene } from './scene';

const TERRAIN_SIZE = 80;
const TERRAIN_SEGS = 40;

export function sampleHeight(
    x: number,
    z: number,
    posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): number {
    const fx = (x / TERRAIN_SIZE + 0.5) * TERRAIN_SEGS;
    const fz = (z / TERRAIN_SIZE + 0.5) * TERRAIN_SEGS;
    const ix0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fx)));
    const iz0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fz)));
    const tx = fx - ix0;
    const tz = fz - iz0;
    const row = TERRAIN_SEGS + 1;
    const h00 = posAttr.getY(iz0 * row + ix0) || 0;
    const h10 = posAttr.getY(iz0 * row + ix0 + 1) || 0;
    const h01 = posAttr.getY((iz0 + 1) * row + ix0) || 0;
    const h11 = posAttr.getY((iz0 + 1) * row + ix0 + 1) || 0;
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

function buildTerrain() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const dist = Math.sqrt(x * x + z * z);
        // Aplatis au centre pour la zone de départ
        if (dist < 6) {
            pos.setY(i, 0);
            continue;
        }
        const h =
            Math.sin(x * 0.15) * 1.2 +
            Math.cos(z * 0.18) * 1.0 +
            Math.sin(x * 0.4 + z * 0.3) * 0.6 +
            (Math.random() - 0.5) * 0.8;
        pos.setY(i, Math.max(0, h));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Herbe / graviers (points déco)
    const grassGeo = new THREE.BufferGeometry();
    const gPositions: number[] = [];
    for (let i = 0; i < 800; i++) {
        const x = (Math.random() - 0.5) * TERRAIN_SIZE;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        gPositions.push(x, sampleHeight(x, z, pos) + 0.15, z);
    }
    grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPositions, 3));
    const grassMat = new THREE.PointsMaterial({ color: 0x6b8a4e, size: 0.3 });
    scene.add(new THREE.Points(grassGeo, grassMat));

    return geo;
}

export const terrainGeo = buildTerrain();

// Quelques rochers
export const rocks: Array<{ mesh: THREE.Mesh; radius: number }> = [];

for (let i = 0; i < 20; i++) {
    const r = 0.3 + Math.random() * 0.9;
    const geo = new THREE.DodecahedronGeometry(r, 0);
    geo.rotateY(Math.random() * Math.PI);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a7060 });
    const rock = new THREE.Mesh(geo, mat);
    rock.castShadow = true;
    const rx = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    const rz = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    rock.position.set(
        rx,
        sampleHeight(rx, rz, terrainGeo.attributes.position) + r * 0.5,
        rz
    );
    scene.add(rock);
    rocks.push({ mesh: rock, radius: r });
}

// Barils explosifs
export const barrels: Array<{ obj: THREE.Object3D; radius: number }> = [];

// Arbres
export const trees: Array<{ group: THREE.Group; radius: number }> = [];

const MAT_TRUNK  = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const MAT_LEAVES = new THREE.MeshLambertMaterial({ color: 0x2d6e1a });

for (let i = 0; i < 25; i++) {
    let tx: number, tz: number;
    do {
        tx = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
        tz = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    } while (Math.sqrt(tx * tx + tz * tz) < 10);

    const g = new THREE.Group();
    const trunkH = 2.0 + Math.random() * 1.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 7), MAT_TRUNK);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);
    // Deux cônes de feuillage empilés
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

const MAT_BARREL = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
const MAT_BAND    = new THREE.MeshLambertMaterial({ color: 0x111111 });

for (let i = 0; i < 10; i++) {
    let bx: number, bz: number;
    do {
        bx = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
        bz = (Math.random() - 0.5) * (TERRAIN_SIZE - 10);
    } while (Math.sqrt(bx * bx + bz * bz) < 10);

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

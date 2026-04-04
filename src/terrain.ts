import * as THREE from 'three';
import { scene } from './scene';

export const TERRAIN_SIZE = 180;
const TERRAIN_SEGS = 70;

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

        // Collines naturelles aux bords — montée quadratique à partir de 78%
        const borderFactor = Math.max(Math.abs(x), Math.abs(z)) / (TERRAIN_SIZE / 2);
        const border       = Math.max(0, (borderFactor - 0.78) / 0.22);
        const borderH      = border * border * 18;

        pos.setY(i, Math.max(0, h) + borderH);
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

export function randomPos(minDist: number, margin = 10): [number, number] {
    let x: number, z: number;
    do {
        x = (Math.random() - 0.5) * (TERRAIN_SIZE - margin);
        z = (Math.random() - 0.5) * (TERRAIN_SIZE - margin);
    } while (Math.sqrt(x * x + z * z) < minDist);
    return [x, z];
}

import * as THREE from 'three';
import { scene } from './scene';

export const TERRAIN_SIZE = 180;
const TERRAIN_SEGS = 70;
/** Fraction du demi-terrain à partir de laquelle les collines de bordure commencent. */
export const BORDER_START = 0.78;

function buildTerrainGeo(): THREE.PlaneGeometry {
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

        // Collines naturelles aux bords — montée quadratique à partir de BORDER_START
        const borderFactor = Math.max(Math.abs(x), Math.abs(z)) / (TERRAIN_SIZE / 2);
        const border       = Math.max(0, (borderFactor - BORDER_START) / (1 - BORDER_START));
        const borderH      = border * border * 18;

        pos.setY(i, Math.max(0, h) + borderH);
    }
    geo.computeVertexNormals();
    return geo;
}

const terrainGeo = buildTerrainGeo();
const _heights   = terrainGeo.attributes.position;

/** Hauteur du terrain en (x, z), interpolée bilinéairement. */
export function sampleHeight(x: number, z: number): number {
    const fx = (x / TERRAIN_SIZE + 0.5) * TERRAIN_SEGS;
    const fz = (z / TERRAIN_SIZE + 0.5) * TERRAIN_SEGS;
    const ix0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fx)));
    const iz0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fz)));
    // Borné : hors de la grille on garde la hauteur du bord au lieu d'extrapoler
    const tx = THREE.MathUtils.clamp(fx - ix0, 0, 1);
    const tz = THREE.MathUtils.clamp(fz - iz0, 0, 1);
    const row = TERRAIN_SEGS + 1;
    const h00 = _heights.getY(iz0 * row + ix0);
    const h10 = _heights.getY(iz0 * row + ix0 + 1);
    const h01 = _heights.getY((iz0 + 1) * row + ix0);
    const h11 = _heights.getY((iz0 + 1) * row + ix0 + 1);
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

function addTerrainMeshes(): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
    const mesh = new THREE.Mesh(terrainGeo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Herbe / graviers (points déco)
    const grassGeo = new THREE.BufferGeometry();
    const gPositions: number[] = [];
    for (let i = 0; i < 800; i++) {
        const x = (Math.random() - 0.5) * TERRAIN_SIZE;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        gPositions.push(x, sampleHeight(x, z) + 0.15, z);
    }
    grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPositions, 3));
    const grassMat = new THREE.PointsMaterial({ color: 0x6b8a4e, size: 0.3 });
    scene.add(new THREE.Points(grassGeo, grassMat));
}

addTerrainMeshes();

export function randomPos(minDist: number, margin = 10): [number, number] {
    let x: number, z: number;
    do {
        x = (Math.random() - 0.5) * (TERRAIN_SIZE - margin);
        z = (Math.random() - 0.5) * (TERRAIN_SIZE - margin);
    } while (Math.sqrt(x * x + z * z) < minDist);
    return [x, z];
}

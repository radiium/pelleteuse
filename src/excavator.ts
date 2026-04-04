import * as THREE from 'three';
import { scene } from './scene';

const MAT_YELLOW = new THREE.MeshLambertMaterial({ color: 0xf0c020 });
const MAT_DARK   = new THREE.MeshLambertMaterial({ color: 0x222222 });
const MAT_CABIN  = new THREE.MeshLambertMaterial({ color: 0xe8b818 });
const MAT_GLASS  = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
const MAT_ARM    = new THREE.MeshLambertMaterial({ color: 0xd4a812 });
const MAT_RUBBER = new THREE.MeshLambertMaterial({ color: 0x333333 });

const _root = new THREE.Group();
scene.add(_root);

// ── Chenilles ─────────────────────────────────────────────────────────────────

const wheels: THREE.Mesh[] = [];

function makeChenille(xOff: number) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.99, 2.1), MAT_RUBBER);
    hull.position.y = 0.27;
    hull.castShadow = true;
    g.add(hull);
    [-1.1, 1.1].forEach((zOff) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), MAT_DARK);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.4, zOff);
        wheels.push(w);
        g.add(w);
    });
    g.position.x = xOff;
    return g;
}

const chenilleL = makeChenille(0);
const chenilleR = makeChenille(0);
chenilleL.position.x = -0.85;
chenilleR.position.x =  0.85;
_root.add(chenilleL);
_root.add(chenilleR);

// Points d'émission de poussière
const dustSpawnL = new THREE.Object3D();
dustSpawnL.position.set(-0.85, 0.05, -0.8);
_root.add(dustSpawnL);

const dustSpawnR = new THREE.Object3D();
dustSpawnR.position.set(0.85, 0.05, -0.8);
_root.add(dustSpawnR);

// ── Corps (plateau tournant) ───────────────────────────────────────────────────

const pivot = new THREE.Group();
_root.add(pivot);
pivot.position.y = 0.55;

const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 2.4), MAT_YELLOW);
body.position.y = 0.32;
body.castShadow = true;
pivot.add(body);

const cabin = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 1), MAT_CABIN);
cabin.position.set(-0.45, 1.05, 0.3);
cabin.castShadow = true;
pivot.add(cabin);

const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.05), MAT_GLASS);
glass.position.set(-0.45, 1.45, 0.8);
pivot.add(glass);

const glassBack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.05), MAT_GLASS);
glassBack.position.set(-0.45, 1.45, -0.225);
pivot.add(glassBack);

const glassLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.8), MAT_GLASS);
glassLeft.position.set(-0.975, 1.45, 0.3);
pivot.add(glassLeft);

const glassRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.8), MAT_GLASS);
glassRight.position.set(0.075, 1.45, 0.3);
pivot.add(glassRight);

const flameSpawn = new THREE.Object3D();
flameSpawn.position.set(-0.45, 1.05 + 1.7 / 2 + 0.1, 0.3);
pivot.add(flameSpawn);

const cw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.9), MAT_DARK);
cw.position.set(0, 0.65, -0.9);
pivot.add(cw);

// ── Bras articulé ─────────────────────────────────────────────────────────────

const boomPivot = new THREE.Group();
boomPivot.position.set(0.4, 0.7, 1.0);
pivot.add(boomPivot);

const boom = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 2.1), MAT_ARM);
boom.position.z = 0.95;
boom.castShadow = true;
boomPivot.add(boom);

const stickPivot = new THREE.Group();
stickPivot.position.z = 1.9;
boomPivot.add(stickPivot);

const stick = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 1.4), MAT_ARM);
stick.position.z = 0.7;
stick.castShadow = true;
stickPivot.add(stick);

const godetPivot = new THREE.Group();
godetPivot.position.z = 1.4;
stickPivot.add(godetPivot);

const BW = 0.82;
const BD = 0.62;
const BH = 0.68;
const bucketProfile = new THREE.Shape();
bucketProfile.moveTo(0, 0);
bucketProfile.lineTo(BD, 0);
bucketProfile.lineTo(BD, -BH);
bucketProfile.closePath();
const bucketGeo = new THREE.ExtrudeGeometry(bucketProfile, { depth: BW, bevelEnabled: false });
const godet = new THREE.Mesh(bucketGeo, MAT_ARM);
godet.rotation.y = -Math.PI / 2;
godet.position.set(BW / 2, 0, 0);
godet.castShadow = true;
godetPivot.add(godet);

boomPivot.rotation.x  = -1.2;
stickPivot.rotation.x =  1.4;
godetPivot.rotation.x =  0.8;

// ── API ───────────────────────────────────────────────────────────────────────

function animateTracks(wheelSpin: number): void {
    wheels.forEach((w) => { w.rotation.x += wheelSpin; });
}

export const excavator = {
    group: _root,
    pivot,
    boomPivot,
    stickPivot,
    godetPivot,
    flameSpawn,
    dustSpawnL,
    dustSpawnR,
    animateTracks,
};

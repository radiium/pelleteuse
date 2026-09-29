import * as THREE from 'three';
import { scene } from './scene';

const ambient = new THREE.AmbientLight(0xfff4e0, 0.6);
scene.add(ambient);

// Le soleil suit la pelleteuse : zone d'ombre réduite (plus nette) mais toujours centrée sur l'action
const SUN_OFFSET = new THREE.Vector3(30, 60, 30);
const SHADOW_HALF = 35;

const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
sun.position.copy(SUN_OFFSET);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -SHADOW_HALF;
sun.shadow.camera.right = SHADOW_HALF;
sun.shadow.camera.top = SHADOW_HALF;
sun.shadow.camera.bottom = -SHADOW_HALF;
scene.add(sun);
scene.add(sun.target); // la cible doit être dans la scène pour que sa matrice suive ses déplacements

export function updateSun(focus: THREE.Vector3): void {
    sun.target.position.copy(focus);
    sun.position.copy(focus).add(SUN_OFFSET);
}

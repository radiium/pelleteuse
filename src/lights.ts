import * as THREE from 'three';
import { scene } from './scene';

const ambient = new THREE.AmbientLight(0xfff4e0, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
sun.position.set(30, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

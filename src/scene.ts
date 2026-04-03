import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87adc7);
scene.fog = new THREE.Fog(0x87adc7, 40, 120);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 12, 20);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { RIGHT: THREE.MOUSE.ROTATE };
controls.enablePan = false;
controls.minDistance = 6;
// controls.maxDistance = 6;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI / 2.2;

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

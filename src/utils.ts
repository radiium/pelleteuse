import * as THREE from 'three';

/** Retire un objet de la scène et libère ses géométries (les matériaux partagés sont conservés). */
export function disposeObject(obj: THREE.Object3D): void {
    obj.parent?.remove(obj);
    obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
}

/** Facteur d'interpolation exponentielle frame-rate indépendant. */
export function expDecay(rate: number, dt: number): number {
    return 1 - Math.exp(-rate * dt);
}

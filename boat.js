import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Create axis lines
function createAxisLine(color, start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color: color });
  return new THREE.Line(geometry, material);
}
const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0));
const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0));
const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5));
scene.add(xAxis);
scene.add(yAxis);
scene.add(zAxis);

let boat = null;
const objLoader = new OBJLoader();
objLoader.load('boat.obj', (object) => {
    object.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        }
    });

    object.position.set(0, 0, 0);
    object.rotation.y = 0; // Ensure boat starts facing the positive x-direction
    object.rotation.x = -1.57;
    // object.rotation.z = 0;
    object.scale.set(0.01, 0.01, 0.01);

    boat = object;
    scene.add(boat);
});

// Movement physics variables
let velocity = 0;
let acceleration = 0.005;
let friction = 0.98;
let angularVelocity = 0;
let angularAcceleration = 0.02;
let maxSpeed = 0.5;
let direction = new THREE.Vector3(1, 0, 0); // Initial direction along x-axis
const movement = { forward: false, backward: false, left: false, right: false };

// Listen for keydown events
window.addEventListener('keydown', (event) => {
    if (event.key === 'w') movement.forward = true;
    if (event.key === 's') movement.backward = true;
    if (event.key === 'a') movement.left = true;
    if (event.key === 'd') movement.right = true;
});

// Listen for keyup events
window.addEventListener('keyup', (event) => {
    if (event.key === 'w') movement.forward = false;
    if (event.key === 's') movement.backward = false;
    if (event.key === 'a') movement.left = false;
    if (event.key === 'd') movement.right = false;
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (boat) {
        // Update rotation for turning
        if (movement.left) {
            boat.rotation.z += angularAcceleration; // Turn left
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angularAcceleration);
        }
        if (movement.right) {
            boat.rotation.z -= angularAcceleration; // Turn right
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angularAcceleration);
        }

        // Update speed and movement in the direction boat is facing
        if (movement.forward) velocity = Math.min(velocity + acceleration, maxSpeed);
        if (movement.backward) velocity = Math.max(velocity - acceleration, -maxSpeed / 2);
        velocity *= friction; // Apply friction

        // Move in the direction the boat is facing
        boat.position.add(direction.clone().multiplyScalar(velocity));

        // Make the camera follow the boat
        const cameraOffset = new THREE.Vector3(-5, 3, 5); // Offset behind and slightly above
        const boatPosition = boat.position.clone();
        const offsetPosition = boatPosition.add(cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y));
        camera.position.lerp(offsetPosition, 0.1); // Smooth camera movement
        camera.lookAt(boat.position);
    }

    renderer.render(scene, camera);
}

animate();

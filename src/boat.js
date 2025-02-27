
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


let objects = [];
let boat = null; // Define boat globally

// Function to load objects dynamically
function loadObject(fileName, position, scale, rotation, isBoat = false) {
    const objLoader = new OBJLoader();
    objLoader.load(`objects/${fileName}`, (object) => {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({ color: 0x776947 });
            }
        });

        object.position.set(position.x, position.y, position.z);
        object.scale.set(scale.x, scale.y, scale.z);
        object.rotation.set(rotation.x, rotation.y, rotation.z);

        scene.add(object);

        if (isBoat) {
            objects.unshift(object); // Ensure boat is the first object
            boat = object; // Set boat reference here when loaded
        } else {
            objects.push(object);
        }
    });
}

// List of objects to load
const objectsToLoad = [
    { file: 'boat.obj', position: new THREE.Vector3(0, 0.5, 0), scale: new THREE.Vector3(0.01, 0.01, 0.01), rotation: new THREE.Vector3(-1.57, 0, 0), isBoat: true },
    // { file: 'head.obj', position: new THREE.Vector3(2, 0, 0), scale: new THREE.Vector3(0.1, 0.1, 0.1), rotation: new THREE.Vector3(-1.57, 0, 0), isBoat: false }
];

// Load objects
objectsToLoad.forEach(obj => loadObject(obj.file, obj.position, obj.scale, obj.rotation, obj.isBoat));

let poolBoundaries = null;
// Function to create a swimming pool-like structure
function createSwimmingPool(width, height, depth, wallThickness) {
    // Create a rectangular shape for the base
    poolBoundaries = {
        minX: -2, maxX: width,
        minZ: -depth/2, maxZ: depth/2
    };
    
    const poolMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color(0x1E90FF) }, // Light Blue
            color2: { value: new THREE.Color(0x0000FF) }, // Dark Blue
            stripeWidth: { value: 10.0 }, // Width of each stripe in world units
        },
        vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position; // Pass position to fragment shader
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float stripeWidth;
            varying vec3 vPosition;
            
            void main() {
                // Create stripes based on the world X-coordinate
                float stripes = mod(floor(vPosition.x / stripeWidth), 2.0);
                gl_FragColor = vec4(mix(color1, color2, stripes), 1.0);
            }
        `,
        side: THREE.DoubleSide // Ensure it renders from both sides
    });
    
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -depth / 2);
    shape.lineTo(width / 2, -depth / 2);
    shape.lineTo(width / 2, depth / 2);
    shape.lineTo(-width / 2, depth / 2);
    shape.lineTo(-width / 2, -depth / 2);

    // Extrude walls upwards
    const extrudeSettings = {
        depth: height, // Pool depth (walls height)
        bevelEnabled: false // No bevel
    };

    // Generate the pool geometry
    const poolGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // const poolMaterial = new THREE.MeshStandardMaterial({ color: 0x1E90FF, side: THREE.DoubleSide }); // Blue color like water
    const poolMesh = new THREE.Mesh(poolGeometry, poolMaterial);

    // Position the pool
    poolMesh.rotation.x = -Math.PI / 2; // Rotate to stand upright
    poolMesh.position.set(width/2, -height, 0); // Lower into the ground

    scene.add(poolMesh);
    return poolMesh;
}

// Create a pool with (width=50, height=20, depth=30, wall thickness=2)
const swimmingPool = createSwimmingPool(500, 10, 30, 1);


let velocity = 0;
let acceleration = 0.03;
let friction = 0.93;
let angularVelocity = 0;
let angularAcceleration = 0.03;
let maxSpeed = 0.8;
let direction = new THREE.Vector3(1, 0, 0); // Initial direction along x-axis
const movement = { forward: false, backward: false, left: false, right: false, freeCamera: false };


window.addEventListener('keydown', (event) => {
    if (event.key === 'w') movement.forward = true;
    if (event.key === 's') movement.backward = true;
    if (event.key === 'a') movement.left = true;
    if (event.key === 'd') movement.right = true;
    if (event.key === ' ') 
        {movement.freeCamera = !movement.freeCamera;  
        boat.position.copy(new THREE.Vector3(0, 0.5, 0));
        velocity = 0;}
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'w') movement.forward = false;
    if (event.key === 's') movement.backward = false;
    if (event.key === 'a') movement.left = false;
    if (event.key === 'd') movement.right = false;
    // if (event.key === ' ') movement.freeCamera = !movement.freeCamera; 
});


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    boat = objects[0]; 

    if (boat) {
        // Update rotation for turning
        if (movement.left) {
            boat.rotation.z += angularAcceleration;
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angularAcceleration);
        }
        if (movement.right) {
            boat.rotation.z -= angularAcceleration;
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angularAcceleration);
        }

        // Update speed and movement in the direction boat is facing
        if (movement.forward) velocity = Math.min(velocity + acceleration, maxSpeed);
        if (movement.backward) velocity = Math.max(velocity - acceleration, -maxSpeed / 2);
        if (!movement.forward && !movement.backward) {
            velocity *= friction; // Apply friction only when no input is given
        }

        let newPosition = boat.position.clone().add(direction.clone().multiplyScalar(velocity));
        newPosition.x = THREE.MathUtils.clamp(newPosition.x, poolBoundaries.minX, poolBoundaries.maxX);
        newPosition.z = THREE.MathUtils.clamp(newPosition.z, poolBoundaries.minZ, poolBoundaries.maxZ);
        boat.position.copy(newPosition); // Apply clamped position
        
        // velocity *= friction; // Apply friction
        boat.position.add(direction.clone().multiplyScalar(velocity));

        // 🎯 **Update HUD Text**
        document.getElementById("directionText").innerText = 
        `Direction: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})\n` +
        `Position: (${boat.position.x.toFixed(2)}, ${boat.position.y.toFixed(2)}, ${boat.position.z.toFixed(2)})\n` +
        `Velocity: ${velocity.toFixed(2)}`;

        // 🎥 **Handle Free Camera Mode**
        if (movement.freeCamera) {
            // Move the camera to (0,10,0) and make it look at the boat
            
            camera.position.lerp(new THREE.Vector3(0, 10, 0), 0.1);
            camera.lookAt(boat.position);
        } else {
            // 🎯 **Make Camera Look Ahead in Boat’s Moving Direction**
            const lookAhead = boat.position.clone().add(direction.clone().multiplyScalar(10));
            camera.lookAt(lookAhead);

            // Make the camera follow the boat
            const cameraOffset = direction.clone().multiplyScalar(-8);
            cameraOffset.y = 3;
            const offsetPosition = boat.position.clone().add(cameraOffset);
            camera.position.lerp(offsetPosition, 0.3); // Smooth camera movement
        }
    }

    renderer.render(scene, camera);
}


animate();

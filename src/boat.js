
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x87ceeb);
document.body.appendChild(renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight();
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 1000;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
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


let obstacles = [];
let boat = null; // Define boat globally
const loader = new OBJLoader();
let playerCollisionMesh;
function loadObj({
    file,
    bbDimensions,
    bbOffset = new THREE.Vector3(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3(1, 1, 1),
    rotation = new THREE.Euler(),
    color = new THREE.Color(0x776947),
    visible = false,
    isPlayer = false,
  }) {
    loader.load(file, (object) => {
      object.position.copy(position);
      object.scale.copy(scale);
      object.rotation.copy(rotation);
  
      object.traverse((child) => {
        if (child.isMesh) {
          child.geometry = mergeVertices(child.geometry);
          child.material = new THREE.MeshPhongMaterial({ color });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
  
      // 🎯 Create collision bounding box
      const collisionMesh = new THREE.Mesh(
        new THREE.BoxGeometry(bbDimensions.x, bbDimensions.y, bbDimensions.z),
        new THREE.MeshBasicMaterial({ wireframe: true })
      );
      collisionMesh.visible = visible;
      collisionMesh.position.copy(position).add(bbOffset);
  
      if (isPlayer) {
        boat = object; // Keep `boat` as the player variable
        playerCollisionMesh = collisionMesh;
        scene.add(boat);
        scene.add(playerCollisionMesh);
      } else {
        scene.add(object);
        scene.add(collisionMesh);
        obstacles.push(collisionMesh);
      }
    });
  }


const objectsToLoad = [
{
    file: "objects/boat.obj",
    position: new THREE.Vector3(0, 0.5, 0),
    scale: new THREE.Vector3(0.01, 0.01, 0.01),
    rotation: new THREE.Euler(-1.57, 0, 0),
    color: new THREE.Color(0xb5823c), 
    bbDimensions: new THREE.Vector3(2, 1, 4), // Bounding Box Size
    bbOffset: new THREE.Vector3(0, 0.5, 0), // Offset if needed
    isPlayer: true, // Mark the boat as the player
    visible: true, // Show wireframe for debugging
},
{
    file: "objects/head.obj",
    position: new THREE.Vector3(30, 0, 0),
    scale: new THREE.Vector3(0.3, 0.3, 0.3),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffe54f), 
    bbDimensions: new THREE.Vector3(1, 1, 1),
    bbOffset: new THREE.Vector3(0, 0.5, 0),
    isPlayer: false,
    visible: true, // Hide wireframe
}
];

// 🎯 Load all objects
objectsToLoad.forEach((obj) => loadObj(obj));



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
let acceleration = 0.02;
let friction = 0.93;
let angularVelocity = 0;
let angularAcceleration = 0.03;
let maxSpeed = 0.3;
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

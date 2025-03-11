
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

(function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='https://mrdoob.github.io/stats.js/build/stats.min.js';document.head.appendChild(script);})()
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 0);

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
// const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0));
// const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0));
// const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5));
// scene.add(xAxis);
// scene.add(yAxis);
// scene.add(zAxis);


let obstacles = [];
let boat = null; // Define boat globally
const loader = new OBJLoader();

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
const swimmingPool = createSwimmingPool(2, 0.1, 1, 0.1);




// let playerCollisionMesh;
let heart = null;
let power = null;
function loadObj({
    file,
    position = new THREE.Vector3(),
    scale = new THREE.Vector3(1, 1, 1),
    rotation = new THREE.Euler(),
    color = new THREE.Color(0x776947),
    copies = 0,
    type = "",
}) {
    loader.load(file, (object) => {


        object.position.copy(position);
        object.scale.copy(scale);
        object.rotation.copy(rotation);
        object.updateMatrixWorld(true);
        
        if (type == "player") {
            boat = object;
        }
        if (type == "heart") {
            
            heart = object;
        }
        if (type == "speed") {
            power = object;
        }

       
        let modelTemplate = null;
        object.traverse((child) => {
            if (child.isMesh) {
                modelTemplate = child;
                child.geometry = mergeVertices(child.geometry);
                child.material = new THREE.MeshPhongMaterial({ color });
                child.castShadow = true;
                child.receiveShadow = true;


                const boundingBox = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                console.log(size);
            }
        });
     
        if (copies > 1) {
            // 🚀 Create multiple separate objects instead of using InstancedMesh
            for (let i = 0; i < copies; i++) {
                const clone = modelTemplate.clone(); // Clone the mesh
                clone.position.set(
                    1.5,
                    10,
                    0
                );
                clone.scale.copy(scale);
                clone.rotation.copy(rotation);
                clone.castShadow = true;
                clone.receiveShadow = true;
                // clone.visible = false;
        
                if (type == "obstacle") obstacles.push(clone); // Store obstacles properly
                scene.add(clone); // Add each obstacle separately
            }
        } else {
            // 🚀 **For single objects, load normally**
            scene.add(object);
            if (type == "obstacle") obstacles.push(object);
        }
        
    });
}




let boatOffset = new THREE.Vector3(0.15, 0.02, 0)
const objectsToLoad = [
{
    file: "objects/boat.obj",
    position: boatOffset,
    scale: new THREE.Vector3(0.0003, 0.0003, 0.0003),
    rotation: new THREE.Euler(-1.57, 0, 0),
    color: new THREE.Color(0xb5823c), 
    // bbDimensions: new THREE.Vector3(2, 1, 4), // Bounding Box Size
    // bbOffset: new THREE.Vector3(0, 0.5, 0), // Offset if needed
    type: "player", // Mark the boat as the player
    // visible: true, // Show wireframe for debugging
},
{
    file: "objects/hectagon.obj",
    position: new THREE.Vector3(1, 0, 0),
    scale: new THREE.Vector3(0.008, 0.008, 0.008),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffe54f), 
    // bbDimensions: new THREE.Vector3(1, 1, 1),
    // bbOffset: new THREE.Vector3(0, 0.5, 0),
    type: "obstacle",
    copies : 8,
},
{
    file: "objects/heart.obj",
    position: new THREE.Vector3(1, 10, 0.5),
    scale: new THREE.Vector3(0.005, 0.005, 0.005),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xff0000), 
    // bbDimensions: new THREE.Vector3(1, 1, 1),
    // bbOffset: new THREE.Vector3(0, 0.5, 0),
    type: "heart",
    // copies : 8,
},
{
    file: "objects/lightning.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.02, 0.02, 0.02),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffff66), 
    // bbDimensions: new THREE.Vector3(1, 1, 1),
    // bbOffset: new THREE.Vector3(0, 0.5, 0),
    type: "speed",
    // copies : 8,
},
];

// 🎯 Load all objects
objectsToLoad.forEach((obj) => loadObj(obj));





let fps = 0.5;      //fill in ur fps(30) / 60
let score = 0;
let velocity = 0;
let acceleration = 0.005 * fps;
let friction = 0.93;
let angularAcceleration = 0.02;
let maxSpeed = 0.02;
let direction = new THREE.Vector3(1, 0, 0); // Initial direction along x-axis
const movement = { forward: false, brake: false, left: false, right: false, freeCamera: false };
let boatLives = 10;
let isImmune = false;
let text = "3";
setTimeout(() => {
    text = "2";
}, 1000);
setTimeout(() => {
    text = "1";
}, 2000);
setTimeout(() => {
    text = "";
}, 3000);

function getUniqueRandomIntegers(count, min, max) {
    const uniqueNumbers = new Set();
    while (uniqueNumbers.size < count) {
        uniqueNumbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(uniqueNumbers);
}

let numToSpawn = 0;
let count = 0;
let powerUP = "";
let buffPos = 0;
function respawnObstacles() {

    // Pick 4-8 obstacles to respawn
    numToSpawn = THREE.MathUtils.randInt(5, 8);
    count = 0;
    console.log("new obstacles"+numToSpawn);
    
    const possibleZPositions = getUniqueRandomIntegers(numToSpawn, -5, 5);
    console.log(possibleZPositions);
    
    // Shuffle obstacles and pick `numToSpawn`
    let shuffledObstacles = [...obstacles].sort(() => Math.random() - 0.5);
    let toRespawn = shuffledObstacles.slice(0, numToSpawn);
    
    let i = 0;
    toRespawn.forEach((obstacle) => {
        obstacle.position.set(1.8, 0, possibleZPositions[i]*0.1);
        obstacle.visible = true;
        i+= 1;
    });

    // Keep the rest invisible at (0,10,0)
    shuffledObstacles.slice(numToSpawn).forEach((obstacle) => {
        obstacle.position.set(0, 10, 0);
        obstacle.visible = false;
    });
    return numToSpawn;
}
numToSpawn = respawnObstacles();

function handleBoatCollision() {
    if (isImmune) return;

    boatLives--;
    velocity = 0;
    text = "START";
    setTimeout(() => {
        text = "";
    }, 2000);
    if (boatLives <= 0) {
        text = "GAME OVER";
        acceleration = 0;
        angularAcceleration = 0;
    } else{
        text = "Ouch!";
        document.getElementById("centerText").style.color = "red";
        setTimeout(() => {
            text = "";
            document.getElementById("centerText").style.color = "white";
        }, 2000);
        
    }

    // Activate immunity for 3 seconds
    isImmune = true;
    setTimeout(() => {
        isImmune = false;
        // boat.material.color.set(0xb5823c); // Change back to brown
    }, 2000);
}


window.addEventListener('keydown', (event) => {
    if (event.key === 'w') movement.forward = true;
    if (event.key === 's') movement.brake = true;
    if (event.key === 'a') movement.left = true;
    if (event.key === 'd') movement.right = true;
    if (event.key === ' ')     //temporary restart
        {movement.freeCamera = !movement.freeCamera;  
        boat.position.copy(boatOffset);
        velocity = 0;
        camera.position.lerp(new THREE.Vector3(-0.2, 0.2, 0), 0.1);
        controls.enableRotate = true;  // Allow rotation
        controls.enablePan = true;     // Allow panning
        controls.enableZoom = true;    // Allow zooming
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'w') movement.forward = false;
    if (event.key === 's') movement.brake = false;      //there's no turning back
    if (event.key === 'a') movement.left = false;
    if (event.key === 'd') movement.right = false;
    // if (event.key === ' ') movement.freeCamera = !movement.freeCamera; 
});

// console.log(obstacles);
// Animation loop
function animate() {
    requestAnimationFrame(animate);
     

    if (boat) {
        // Update rotation for turning
        if (movement.left) {
            if (boat.rotation.z < 1){
                boat.rotation.z += angularAcceleration;
                direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angularAcceleration);
            }
            
        }
        if (movement.right) {
            if (boat.rotation.z > -1){
                boat.rotation.z -= angularAcceleration;
                direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angularAcceleration);
            }
        }

        // Update speed and movement in the direction boat is facing
        if (movement.forward) velocity = Math.min(velocity + acceleration, maxSpeed);
        if (movement.brake) velocity *= friction;
        if (!movement.forward && !movement.brake) {
            velocity *= friction; // Apply friction only when no input is given
        }

        let movementVector = direction.clone().multiplyScalar(velocity);
        
        // 🎯 Split movement into X and Z components
        let movementX = new THREE.Vector3(movementVector.x, 0, 0); // Forward/backward
        let movementZ = new THREE.Vector3(0, 0, movementVector.z); // Left/rightw

        // 🎯 Apply X-movement (forward/backward) to obstacles in reverse
        heart.position.sub(movementX);
        power.position.sub(movementX);
        obstacles.forEach((obstacle) => {
            obstacle.position.sub(movementX); // Move obstacles in opposite X direction
            
            if (obstacle.position.x < 0) { // they are in the past
                obstacle.visible = false;
                obstacle.position.copy(0,10,0);
                score += 1;
                count +=1;
                if (count == numToSpawn){
                    numToSpawn = respawnObstacles();
                // console.log(count, numToSpawn);

                // spawn powerups
                    const randomValue = Math.random(); // Random number between 0 and 1
                    let rand = new THREE.Vector3(1.8, 0, Math.random()-0.5);
                    console.log(rand);
                    if (randomValue < 0.25) {
                        heart.position.copy(rand);
                    } else if (randomValue < 0.50) {
                        power.position.copy(rand);
                    } else {
                        heart.position.copy(0,10,0);
                        power.position.copy(0,10,0);
                        // 50% chance (no power-up)
                    }
                }
                    
            
            }
            obstacle.updateMatrixWorld(true);  // Force update

           
            if (boat.position.distanceTo(obstacle.position) < 0.05) {    //simple position based collision detect
                console.log("hit");
                handleBoatCollision();
            }
            
        });

        
        // 🎯 Apply Z-movement (left/right) to the boat itself
        let newBoatPosition = boat.position.clone().add(movementZ);
        newBoatPosition.z = THREE.MathUtils.clamp(newBoatPosition.z, poolBoundaries.minZ * 0.9, poolBoundaries.maxZ * 0.9);
        boat.position.copy(newBoatPosition);

        
   

        // 🎯 **Update HUD Text**
        document.getElementById("directionText").innerText = 
        `Score: ${score}\n` +
        `Life: ${boatLives}\n` +
        `${isImmune}\n` +
        // `Position: (${boat.position.x.toFixed(2)}, ${boat.position.y.toFixed(2)}, ${boat.position.z.toFixed(2)})\n` +
        `Velocity: ${(velocity*500).toFixed(2)}`;

        // 🎯 **Update Centered Text**
        // text = "start";
        document.getElementById("centerText").innerText = text;
        document.getElementById("centerText").style.display = text ? "block" : "none"; // Show if text is not empty

        // 🎥 **Handle Free Camera Mode**
        if (movement.freeCamera) {
            // Move the camera to (0,10,0) and make it look at the boat
            
            
            camera.lookAt(boat.position);
        } else {
            // 🎯 **Make Camera Look Ahead in Boat’s Moving Direction**
            const lookAhead = boat.position.clone().add(direction.clone().multiplyScalar(10));
            camera.lookAt(lookAhead);

            // Make the camera follow the boat
            const cameraOffset = direction.clone().multiplyScalar(-0.3);
            cameraOffset.y = 0.2;
            const offsetPosition = boat.position.clone().add(cameraOffset);
            camera.position.lerp(offsetPosition, 0.3); // Smooth camera movement
        }
    }

    renderer.render(scene, camera);
}


animate();


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
renderer.setClearColor(0x87ceeb);    //set the sky blue
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
createSwimmingPool(3, 0.1, 1, 0.1);





let obstacles = [];
let boat = null; 
let heart = null;
let power = null;
const loader = new OBJLoader();
let unusedObstacles = [];
let activeObstacles = [];

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
        
        if (type == "player") { boat = object;}
        if (type == "heart") { heart = object; heart.visible = false;}
        if (type == "speed") { power = object; power.visible = false;}

       
        let modelTemplate = null;
        object.traverse((child) => {
            if (child.isMesh) {
                modelTemplate = child;
                child.geometry = mergeVertices(child.geometry);
                child.material = new THREE.MeshPhongMaterial({ color });
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
     
        if (copies > 1) {
            // 🚀 Create multiple separate objects instead of using InstancedMesh
            for (let i = 0; i < copies; i++) {
                const clone = modelTemplate.clone(); // Clone the mesh
                clone.position.set( 0,10,0);
                clone.scale.copy(scale);
                clone.rotation.copy(rotation);
                clone.castShadow = true;
                clone.receiveShadow = true;
        
                if (type == "obstacle") {
                    obstacles.push(clone);
                    unusedObstacles.push(clone);
                } 
                scene.add(clone); // Add each obstacle separately
            }
        } else {
            // 🚀 **For single objects, load normally**
            scene.add(object);
            if (type == "obstacle") {
                obstacles.push(object);
                unusedObstacles.push(object);
            } 
        }
        
    });
}




let boatOffset = new THREE.Vector3(0.15, 0.02, 0)
const objectsToLoad = [    //The boat, the heart, and the power-up
{
    file: "public/boat.obj",
    position: boatOffset,
    scale: new THREE.Vector3(0.0005, 0.0005, 0.0005),
    rotation: new THREE.Euler(-1.57, 0, 0),
    color: new THREE.Color(0xb5823c), 
    type: "player", // Mark the boat as the player
},
{
    file: "public/heart.obj",
    position: new THREE.Vector3(1, 10, 0.5),
    scale: new THREE.Vector3(0.005, 0.005, 0.005),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xff0000), 
    type: "heart",
},
{
    file: "public/lightning.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.02, 0.02, 0.02),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffff66), 
    type: "speed",
},
];

const levelObstacles = [     //for each level, right now all just hectagons
    {
        file: "public/hectagon.obj",      //acient egypt
        position: new THREE.Vector3(1, 10, 0),
        scale: new THREE.Vector3(0.012, 0.012, 0.05),
        rotation: new THREE.Euler(-1.57, 0, 1.57),
        color: new THREE.Color(0xffe54f), 
        type: "obstacle",
        copies : 20,
    },
    {                                     //jurastic
        file: "public/hectagon.obj",
        position: new THREE.Vector3(1, 10, 0),
        scale: new THREE.Vector3(0.012, 0.012, 0.05),
        rotation: new THREE.Euler(-1.57, 0, 1.57),
        color: new THREE.Color(0x336600), 
        type: "obstacle",
        copies : 20,
    },
    {                                    //dark ages
        file: "public/hectagon.obj",
        position: new THREE.Vector3(1, 10, 0),
        scale: new THREE.Vector3(0.012, 0.012, 0.05),
        rotation: new THREE.Euler(-1.57, 0, 1.57),
        color: new THREE.Color(0x404040), 
        type: "obstacle",
        copies : 20,
    },
    {                                    //future-cyberpunk
        file: "public/hectagon.obj",
        position: new THREE.Vector3(1, 10, 0),
        scale: new THREE.Vector3(0.012, 0.012, 0.05),
        rotation: new THREE.Euler(-1.57, 0, 1.57),
        color: new THREE.Color(0xcc99ff), 
        type: "obstacle",
        copies : 20,
    },
]

// 🎯 Load all objects
loadObj(levelObstacles[0]);
objectsToLoad.forEach((obj) => loadObj(obj));





let fps = 0.5;      //fill in ur fps / 60, like if 30 -> 30/60 = 0.5
let velocity = 0;
let acceleration = 0.005 * fps;
let friction = 0.93;
let angularAcceleration = 0.02;
let maxSpeed = 0.02;
let direction = new THREE.Vector3(1, 0, 0); // Initial direction along x-axis
const movement = { forward: false, brake: false, left: false, right: false, freeCamera: false };
let boatLives = 3;
let isImmune = false;
let distanceTraveled = 0; 
let level = 1;
let text = "3";
let levelTreshold = 30;
setTimeout(() => {    text = "2";}, 1000);
setTimeout(() => {    text = "1";}, 2000);
setTimeout(() => {    text = "";}, 3000);



function resetLevel() {
    console.log(`Switching to Level ${level}`);

    // 🎯 Reset player state
    boatLives = 3;
    velocity = 0;
    distanceTraveled = 0;
    
    // 🎯 Clear current obstacles
    activeObstacles.forEach(obstacle => {
        obstacle.visible = false;
        scene.remove(obstacle);
    });
    unusedObstacles.forEach(obstacle => scene.remove(obstacle));

    activeObstacles = [];
    unusedObstacles = [];
    obstacles = [];

    // 🎯 Load new obstacles based on level
    loadObj(levelObstacles[level-1]);

    // 🎯 Change environment settings (placeholder)
    // let envConfig = levelEnvironmentConfigs[level] || levelEnvironmentConfigs[1];
    // document.body.style.backgroundImage = `url('textures/${envConfig.background}')`; // Example of changing background
    // console.log(`Water color changed to: ${envConfig.waterColor}`);

    text = `LEVEL ${level}`;
    setTimeout(() => { text = ""; }, 2000);
}

function respawnObstacles() {
    if (unusedObstacles.length <= 10) return; // Prevent excessive spawning

    let numToSpawn = THREE.MathUtils.randInt(5, 10); // Decide how many to spawn
    console.log(`Spawning ${numToSpawn} obstacles`);

    
    for (let i = 0; i < numToSpawn; i++) {
        if (unusedObstacles.length === 0) break; // Safety check

        let obstacle = unusedObstacles.pop(); // Get an obstacle from the pool
        obstacle.position.set(
            THREE.MathUtils.randFloat(3, 8), // X position far away
            0, // Y stays the same
            THREE.MathUtils.randFloat(-0.5, 0.5) // Z is randomized
        );
        obstacle.visible = true;
        activeObstacles.push(obstacle);
    }
    // 🎯 Randomly decide to spawn a power-up (1/4 chance each)
    const spawnChance = Math.random();
    let powerUpPos = new THREE.Vector3(
        THREE.MathUtils.randFloat(3, 8), // X position far away
        0, // Y stays the same
        THREE.MathUtils.randFloat(-0.5, 0.5) // Z is randomized
    );

    if (spawnChance < 0.25 && !heart.visible) {
        
        heart.position.copy(powerUpPos);
        heart.visible = true;
    } else if (spawnChance < 0.50 && !heart.visible) {
        power.position.copy(powerUpPos);
        power.visible = true;
    }
}


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


// Animation loop
function animate() {
    requestAnimationFrame(animate);
     

    if (boat) {
        // BOAT MOVEMENT
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
        if (movement.forward) velocity = Math.min(velocity + acceleration, maxSpeed);
        if (movement.brake) velocity *= friction;
        if (!movement.forward && !movement.brake) {
            velocity *= friction; // Apply friction only when no input is given
        }
        let movementVector = direction.clone().multiplyScalar(velocity);
        // 🎯 Split movement into X and Z components
        let movementX = new THREE.Vector3(movementVector.x, 0, 0); // Forward/backward
        let movementZ = new THREE.Vector3(0, 0, movementVector.z); // Left/rightw        

        let newBoatPosition = boat.position.clone().add(movementZ);
        newBoatPosition.z = THREE.MathUtils.clamp(newBoatPosition.z, poolBoundaries.minZ * 0.9, poolBoundaries.maxZ * 0.9);
        boat.position.copy(newBoatPosition);


         // 🎯 Apply X-movement (forward/backward) to obstacles/objects in reverse
         heart.position.sub(movementX);
         power.position.sub(movementX);
         for (let i = activeObstacles.length - 1; i >= 0; i--) {
             let obstacle = activeObstacles[i]
             obstacle.position.sub(movementX); // Move obstacles in opposite X direction
             
             if (obstacle.position.x < -0.5) { // If past the boat
                 obstacle.visible = false;
                 obstacle.position.set(0, 10, 0); // Hide it
                 activeObstacles.splice(i, 1); // Remove from active list
                 unusedObstacles.push(obstacle); // Add back to unused pool
             }
 
             obstacle.updateMatrixWorld(true);  // Force update
 
             let detectionRange = 0.08;
             if (boat.position.distanceTo(obstacle.position) < detectionRange) {    //simple position based collision detect
                 console.log("hit");
                 handleBoatCollision();
             }
         };

        if (boat.position.distanceTo(heart.position) < 0.08) {
            text = "Life+1";
            setTimeout(() => {    text = "";}, 1000)
            heart.position.set(0, 10, 0); // Hide it
            heart.visible = false;
            boatLives++; // 🎯 Increase life
        }

        if (boat.position.distanceTo(power.position) < 0.08) {
            text = "Rush!!Just keep going forward!";
            setTimeout(() => {    text = "";}, 10000)
            power.position.set(0, 10, 0); // Hide it
            power.visible = false;

            // 🎯 Apply power-up effect
            maxSpeed *= 2; // 🚀 Double acceleration
            acceleration *= 2; // 🚀 Double acceleration
            isImmune = true;
            setTimeout(() => {
                maxSpeed /= 2;
                acceleration /=2;
                isImmune = false;
            }, 10000)
        }
        // 🎯 Detect Level
        distanceTraveled+=movementX.x;
        if (distanceTraveled >= levelTreshold) {
            level++; // Increase level
            resetLevel();    
        }

        if (unusedObstacles.length > 10) {
            respawnObstacles();
        }

        // 🎯 **Update HUD Text**
        document.getElementById("directionText").innerText = 
        `Life: ${boatLives}\n` +
        `Level: ${level}\n` +
        `Distance till exit: ${(levelTreshold-distanceTraveled).toFixed(1)}\n` 
        ;

        // 🎯 **Update Centered Text**
        document.getElementById("centerText").innerText = text;
        document.getElementById("centerText").style.display = text ? "block" : "none"; // Show if text is not empty

        // 🎥 **Handle Free Camera Mode**   // could be deleted in the end
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

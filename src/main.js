// **********************************************************************************************
// *************************************** TERMINAL SETUP ***************************************
// **********************************************************************************************
//  npm install --save three
//  npm install --save-dev vite

// GUI
//      npm install dat.gui --save-dev
//      npm install @types/dat.gui --save-dev

// FPS COUNTER
//      npm install --save stats.js

// START UP HTML PAGE
//      npx vite
// **********************************************************************************************

// ************************************************************************************************
// ********************************** SCENE SETUP + DEPENDENCIES **********************************
// ************************************************************************************************
// DEPENDENCIES
import * as dat from "dat.gui"; // GUI
import Stats from "stats.js"; // FPS counter
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
(function () {
  var script = document.createElement("script");
  script.onload = function () {
    var stats = new Stats();
    document.body.appendChild(stats.dom);
    requestAnimationFrame(function loop() {
      stats.update();
      requestAnimationFrame(loop);
    });
  };
  script.src = "https://mrdoob.github.io/stats.js/build/stats.min.js";
  document.head.appendChild(script);
})();
// Scene setup
// import { compute, step } from 'three/tsl';

const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

// background image
textureLoader.load(
  "assets/background_image/light_trails_1.jpg",
  function (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    scene.background = texture;
  }
);

//THREE.PerspectiveCamera( fov angle, aspect ratio, near depth, far depth );
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x87ceeb);
document.body.appendChild(renderer.domElement);

// ADD FPS COUNTER
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1;
controls.maxDistance = 3;
// camera.position.set(1.5, 1.5, 1.5);
// controls.target.set(0, 0, 0);
// 2D testing
camera.position.set(0.5, 0.5, 3);
controls.target.set(0.5, 0, 1.5);

// // Rendering 3D axis
// const createAxisLine = (color, start, end) => {
//     const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
//     const material = new THREE.LineBasicMaterial({ color: color });
//     return new THREE.Line(geometry, material);
// };
// const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 0)); // Red
// const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0)); // Green
// const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 3)); // Blue
// scene.add(xAxis);
// scene.add(yAxis);
// scene.add(zAxis);

// Setting up the lights
const pointLight = new THREE.PointLight(0xffffff, 100, 100);
pointLight.position.set(5, 5, 5); // Position the light
scene.add(pointLight);

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// directionalLight.position.set(0.5, .0, 1.0).normalize();
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
    minX: -2,
    maxX: width,
    minZ: -depth / 2,
    maxZ: depth / 2,
  };

  const poolMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(0x1e90ff) }, // Light Blue
      color2: { value: new THREE.Color(0x0000ff) }, // Dark Blue
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
    side: THREE.DoubleSide, // Ensure it renders from both sides
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
    bevelEnabled: false, // No bevel
  };

  // Generate the pool geometry
  const poolGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // const poolMaterial = new THREE.MeshStandardMaterial({ color: 0x1E90FF, side: THREE.DoubleSide }); // Blue color like water
  const poolMesh = new THREE.Mesh(poolGeometry, poolMaterial);

  // Position the pool
  poolMesh.rotation.x = -Math.PI / 2; // Rotate to stand upright
  poolMesh.position.set(width / 2, -height, 0); // Lower into the ground

  scene.add(poolMesh);
  return poolMesh;
}
createSwimmingPool(3, 0.1, 1, 0.1);

let obstacles = [];
let boat = null;
let heart = null;
let power = null;
const objLoader = new OBJLoader();
let unusedObstacles = [];
let activeObstacles = [];

const ambientLight = new THREE.AmbientLight("rgb(178, 125, 1)", 4); // Soft white light //0x505050
scene.add(ambientLight);

const phong_material = new THREE.MeshPhongMaterial({
  color: 0x00ff00, // Green color
  shininess: 100, // Shininess of the material
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshPhongMaterial({ color: 0x2e8b57 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

const waterLevelGeometry = new THREE.PlaneGeometry();
const waterLevelMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0.5,
});
const waterLevelMesh = new THREE.Mesh(waterLevelGeometry, waterLevelMaterial);
waterLevelMesh.rotation.x = -Math.PI / 2;
waterLevelMesh.visible = false;
scene.add(waterLevelMesh);
// **************************************************************************************************

// **************************************************************************************************
// *********************************** OBJECT LOADING ***********************************************
// **************************************************************************************************
function generateRandomGeometry() {
  const geometries = [
    new THREE.BoxGeometry(
      Math.random() / 3,
      Math.random() / 3,
      Math.random() / 3
    ),
    new THREE.CapsuleGeometry(Math.random() / 3, Math.random() / 3),
    new THREE.CylinderGeometry(
      Math.random() / 3,
      Math.random() / 3,
      Math.random() / 3
    ),
    new THREE.DodecahedronGeometry(Math.random() / 3),
    new THREE.IcosahedronGeometry(Math.random() / 3),
    new THREE.OctahedronGeometry(Math.random() / 3),
    new THREE.TetrahedronGeometry(Math.random() / 3),
  ];

  return geometries[Math.floor(Math.random() * geometries.length)];
}

function generateRandomPosition() {
  let randomX = Math.random() * 2 - 1;
  while (Math.abs(randomX) < 0.5) randomX = Math.random() * 2 - 1;
  let randomZ = Math.random() * 2 - 1;
  while (Math.abs(randomZ) < 0.5) randomZ = Math.random() * 2 - 1;
  return new THREE.Vector3(randomX, 0, randomZ);
}

const obstaclesArr = [];
const normalsMap = new Map();
const verticesMap = new Map();
const NUM_OBSTACLES = 10;
const tempVector = new THREE.Vector3();

for (let i = 0; i < NUM_OBSTACLES; i++) {
  const obstacle = new THREE.Mesh(
    generateRandomGeometry(),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
    })
  );
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  const randomPosition = generateRandomPosition();
  obstacle.position.set(randomPosition.x, 0, randomPosition.z);
  scene.add(obstacle);
  obstaclesArr.push(obstacle);
  normalsMap.set(obstacle, getNormals(obstacle));
  verticesMap.set(obstacle, getVertices(obstacle));
}

let player;
let playerCollisionMesh;

// file: name of the obj file
// bbDimensions: dimensions of the bounding box of the object
// bbOffset: offset of the bounding box from the center of the object
// position: position of the object
// scale: scale of the object
// rotation: rotation of the object
// color: color of the object
// meshVisible: whether the object's collision mesh is visible
// isPlayer: whether the object is the player (only one object can be the player)
function loadObj({
  file,
  position = new THREE.Vector3(),
  scale = new THREE.Vector3(1, 1, 1),
  rotation = new THREE.Euler(),
  color = new THREE.Color(0x776947),
  copies = 0,
  type = "",
}) {
  objLoader.load(file, (object) => {
    object.position.copy(position);
    object.scale.copy(scale);
    object.rotation.copy(rotation);
    object.updateMatrixWorld(true);

    if (type == "player") {
      boat = object;
    }
    if (type == "heart") {
      heart = object;
      heart.visible = false;
    }
    if (type == "speed") {
      power = object;
      power.visible = false;
    }

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
        clone.position.set(0, 10, 0);
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

let boatOffset = new THREE.Vector3(0.15, 0.02, 0);
const objectsToLoad = [
  //The boat, the heart, and the power-up
  {
    file: "boat.obj",
    position: boatOffset,
    scale: new THREE.Vector3(0.0005, 0.0005, 0.0005),
    rotation: new THREE.Euler(-1.57, 0, 0),
    color: new THREE.Color(0xb5823c),
    type: "player", // Mark the boat as the player
  },
  {
    file: "heart.obj",
    position: new THREE.Vector3(1, 10, 0.5),
    scale: new THREE.Vector3(0.005, 0.005, 0.005),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xff0000),
    type: "heart",
  },
  {
    file: "lightning.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.02, 0.02, 0.02),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffff66),
    type: "speed",
  },
];

const levelObstacles = [
  //for each level, right now all just hectagons
  {
    file: "hectagon.obj", //acient egypt
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.012, 0.012, 0.05),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xffe54f),
    type: "obstacle",
    copies: 20,
  },
  {
    //jurastic
    file: "hectagon.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.012, 0.012, 0.05),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0x336600),
    type: "obstacle",
    copies: 20,
  },
  {
    //dark ages
    file: "hectagon.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.012, 0.012, 0.05),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0x404040),
    type: "obstacle",
    copies: 20,
  },
  {
    //future-cyberpunk
    file: "hectagon.obj",
    position: new THREE.Vector3(1, 10, 0),
    scale: new THREE.Vector3(0.012, 0.012, 0.05),
    rotation: new THREE.Euler(-1.57, 0, 1.57),
    color: new THREE.Color(0xcc99ff),
    type: "obstacle",
    copies: 20,
  },
];

// 🎯 Load all objects
loadObj(levelObstacles[0]);
objectsToLoad.forEach((obj) => loadObj(obj));

let fps = 0.5; //fill in ur fps / 60, like if 30 -> 30/60 = 0.5
let velocity = 0;
let acceleration = 0.005 * fps;
let friction = 0.93;
let angularAcceleration = 0.02;
let maxSpeed = 0.02;
let direction = new THREE.Vector3(1, 0, 0); // Initial direction along x-axis
const movement = {
  forward: false,
  brake: false,
  left: false,
  right: false,
  freeCamera: false,
};
let boatLives = 3;
let isImmune = false;
let distanceTraveled = 0;
let level = 1;
let text = "3";
let levelTreshold = 30;
setTimeout(() => {
  text = "2";
}, 1000);
setTimeout(() => {
  text = "1";
}, 2000);
setTimeout(() => {
  text = "";
}, 3000);

function resetLevel() {
  console.log(`Switching to Level ${level}`);

  // 🎯 Reset player state
  boatLives = 3;
  velocity = 0;
  distanceTraveled = 0;

  // 🎯 Clear current obstacles
  activeObstacles.forEach((obstacle) => {
    obstacle.visible = false;
    scene.remove(obstacle);
  });
  unusedObstacles.forEach((obstacle) => scene.remove(obstacle));

  activeObstacles = [];
  unusedObstacles = [];
  obstacles = [];

  // 🎯 Load new obstacles based on level
  loadObj(levelObstacles[level - 1]);

  // 🎯 Change environment settings (placeholder)
  // let envConfig = levelEnvironmentConfigs[level] || levelEnvironmentConfigs[1];
  // document.body.style.backgroundImage = `url('textures/${envConfig.background}')`; // Example of changing background
  // console.log(`Water color changed to: ${envConfig.waterColor}`);

  text = `LEVEL ${level}`;
  setTimeout(() => {
    text = "";
  }, 2000);
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
  } else if (spawnChance < 0.5 && !heart.visible) {
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
  } else {
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

window.addEventListener("keydown", (event) => {
  if (event.key === "w") movement.forward = true;
  if (event.key === "s") movement.brake = true;
  if (event.key === "a") movement.left = true;
  if (event.key === "d") movement.right = true;
  if (event.key === " ") {
    //temporary restart
    movement.freeCamera = !movement.freeCamera;
    boat.position.copy(boatOffset);
    velocity = 0;
    camera.position.lerp(new THREE.Vector3(-0.2, 0.2, 0), 0.1);
    controls.enableRotate = true; // Allow rotation
    controls.enablePan = true; // Allow panning
    controls.enableZoom = true; // Allow zooming
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "w") movement.forward = false;
  if (event.key === "s") movement.brake = false; //there's no turning back
  if (event.key === "a") movement.left = false;
  if (event.key === "d") movement.right = false;
  // if (event.key === ' ') movement.freeCamera = !movement.freeCamera;
});

// **************************************************************************************************
// *********************************** SAT COLLISION DETECTION **************************************
// **************************************************************************************************
function positiveVectorKey(vector) {
  return `${Math.round(vector.x * 1000)},${Math.round(
    vector.y * 1000
  )},${Math.round(vector.z * 1000)}`;
}

function negativeVectorKey(vector) {
  return `${Math.round(-vector.x * 1000)},${Math.round(
    -vector.y * 1000
  )},${Math.round(-vector.z * 1000)}`;
}

function getNormals(object) {
  const normalsAttribute = object.geometry.getAttribute("normal");
  const unique = new Set();
  const normals = [];

  object.updateMatrixWorld(true);

  for (let i = 0; i < normalsAttribute.count; i++) {
    tempVector
      .fromBufferAttribute(normalsAttribute, i)
      .applyMatrix4(object.matrixWorld.invert().transpose())
      .normalize();
    const positiveKey = positiveVectorKey(tempVector);
    const negativeKey = negativeVectorKey(tempVector);
    if (unique.has(positiveKey) || unique.has(negativeKey)) continue;
    unique.add(positiveKey);
    unique.add(negativeKey);
    normals.push(tempVector.clone());
  }

  return normals;
}

function getVertices(object) {
  const verticesAttribute = object.geometry.getAttribute("position");
  const vertices = [];

  for (let i = 0; i < verticesAttribute.count; i++) {
    tempVector
      .fromBufferAttribute(verticesAttribute, i)
      .applyMatrix4(object.matrixWorld);
    vertices.push(tempVector.clone());
  }

  return vertices;
}

function checkCollision(playerCollisionMesh, obstacle) {
  let minOverlap = Infinity;
  let minAxis;

  const allAxes = removeDuplicates([
    ...normalsMap.get(playerCollisionMesh),
    ...normalsMap.get(obstacle),
  ]);

  for (const axis of allAxes) {
    const projection1 = getProjection(playerCollisionMesh, axis);
    const projection2 = getProjection(obstacle, axis);

    if (
      projection1.max <= projection2.min ||
      projection2.max <= projection1.min
    )
      return;

    const overlap = Math.min(
      projection1.max - projection2.min,
      projection2.max - projection1.min
    );

    if (overlap < minOverlap) {
      minOverlap = overlap;
      minAxis = axis;
    }
  }

  return { minAxis, minOverlap };
}

function removeDuplicates(normals) {
  const unique = new Set();

  return normals.filter((normal) => {
    const positiveKey = positiveVectorKey(normal);
    const negativeKey = negativeVectorKey(normal);
    if (unique.has(positiveKey) || unique.has(negativeKey)) return false;
    unique.add(positiveKey);
    unique.add(negativeKey);
    return true;
  });
}

function getProjection(object, axis) {
  if (object === playerCollisionMesh)
    verticesMap.set(playerCollisionMesh, getVertices(playerCollisionMesh));

  const vertices = verticesMap.get(object);
  let min = Infinity;
  let max = -Infinity;

  for (const vertex of vertices) {
    const dot = axis.dot(vertex);
    min = Math.min(min, dot);
    max = Math.max(max, dot);
  }

  return { min, max };
}
// **************************************************************************************************

// **************************************************************************************************
// *********************************** BOAT MOVEMENT ************************************************
// **************************************************************************************************
const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  " ": false,
  shift: false,
};

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
});

let boatVelocity = 0;
let isRocking = false;
let hasImmunity = false;
const ACCELERATION = 0.002;
const ROTATION_SPEED = 0.05;
const VERTICAL_SPEED = 0.005;
const FRICTION = 0.99;
const COLLISION_CHECK_RADIUS = 1;
const boatDirection = new THREE.Vector3(0, 0, -1);
const worldUp = new THREE.Vector3(0, 1, 0);
const toObstacle = new THREE.Vector3();

function animateRocking() {
  isRocking = true;

  let elapsedTime = 0;
  const MS_PER_FRAME = 1000 / 120;
  const ROCKING_DURATION = 1000;
  const MAX_OFFSET = Math.PI / 6;
  const DAMPING = 10;
  const NUM_OSCILLATIONS = 5;
  const IMMUNITY_DURATION = 1000;

  const animation = setInterval(() => {
    elapsedTime += MS_PER_FRAME;

    const progress = elapsedTime / ROCKING_DURATION;
    const offset =
      MAX_OFFSET *
      Math.exp(-DAMPING * progress) *
      Math.sin(2 * Math.PI * NUM_OSCILLATIONS * progress);
    player.rotation.x = -Math.PI / 2 + offset;
    playerCollisionMesh.rotation.x = offset;

    if (elapsedTime >= ROCKING_DURATION / 3) {
      clearInterval(animation);
      isRocking = false;
      hasImmunity = true;

      setTimeout(() => {
        hasImmunity = false;
      }, IMMUNITY_DURATION);
    }
  }, MS_PER_FRAME);
}
// **************************************************************************************************

// **************************************************************************************************
// *********************************** OBSTACLE OBJECTS IN SCENE ************************************
// **************************************************************************************************
let animation_time = 0;

// ARRAY OF OBSTACLE MESHES - used to calculate interactions with fluid based on obstacle positions
let obstacle_objects_in_scene = []; // *** ADD ALL OBSTACLES CURRENTLY IN THE SCENE TO THIS ARRAY FOR FLUID TO INTERACT WITH IT

// EXAMPLE OBSTACLES - generate some random boxes and control their movement with the keyboard
const boxGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15);
const boxMaterial = new THREE.MeshPhongMaterial({
  color: "rgb(197, 48, 48)",
  transparent: true,
  opacity: 1,
  side: THREE.DoubleSide,
});

// Function to create a box at a random position
function createBox(x, y, z) {
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.position.set(x, y, z);
  scene.add(box);
  obstacle_objects_in_scene.push(box);
}

// randomly enerate box obstacles within the given x and z range
for (let i = 0; i < 50; i++) {
  let randomX = Math.random() * 1; // x between 0 and 0.8
  let randomZ = (Math.random() - 1) * 100;
  createBox(randomX, 0.2, randomZ);
}
// **************************************************************************************************

// **************************************************************************************************
// *********************************** SET UP FLUID AND BOUNDARY ************************************
// **************************************************************************************************
// PARAMETERS CONTROLLABLE IN GUI
var params = {
  // FLUID VISULIZATION
  point_radius: 0.12, // 0.08 nice visually with Gaussian Sprite material
  point_opacity: 0.7, // 0.6 nice visually
  show_neighbor_search: false,

  // BOUNDARY VISUALIZATION
  boundary_point_size: 0.01,
  boundary_point_opacity: 1,
  boundary_box_width: 1, // previously 0.8
  boundary_box_length: 3, // previously 1.4

  // FLUID PROPERTIES
  stiffness: 1, // previously 0.5
  viscosity: 100, // unstable for > 500 --- mu in equations, viscosity of the fluid that resists velocity change
  smoothing_radius: 0.15, // <= 0.1 nicer looking
  grav_strength: 1.5, // previously 1.5
  rest_density_factor: 1, // unstable for < 2

  // BUOYANCY PROPERTIES
  buoyancy_strength: 1, // Multiplier for buoyancy force
  buoyancy_sample_points: 10, // Number of sample points to use to calculate the water level
  show_water_level: false, // Show the water level

  // OBJECTS THAT INTERACT WITH FLUID
  object_interaction_strength: 0.35, // previously 0.2
  interaction_length_scale: 1,
};

// NUMBER OF POINTS
// in 3d max ~1500 with current smoothing radius of 0.1
// const water_color = "rgb(26, 169, 208)"; // vibrant water color: "rgb(26, 169, 208)"
var colorParams = {
  // note: make sure one value close to zero so not washed out with white
  r: 0.04,
  g: 0.65,
  b: 0.5,
};
// const water_color = `rgb(${colorParams.r * 255}, ${colorParams.g * 255}, ${colorParams.b * 255})`;
const num_fluid_points = 1000; // number of points in the fluid // ***** NOTE in 2D: >30 FPS when <510 fluid points with no algorithmic acceleration. With algorithmic acceleration can do ~800
const num_boundary_particles = 0; // number of points on the boundary
const num_points = num_fluid_points + num_boundary_particles; // number of points in the fluid

// PARTICLE PROPERTIES (NON-GUI)
const mass = 1;
const mass_boundary = 1;
const grav_drop_off_strength = 20; // how quickly gravity drops off when near boundary
const boundary_buffer = 0.05;
const clamp_density = true; // aids in issue of density near free surface by ensuring minimum density at all points
// const boundary_force_strength = 0.; // strength of boundary force

// STABILITY CONTROLS (NON-GUI)
const min_separation = 0.00005; // ** VERY IMPORTANT - minimum separation between particles to prevent division by zero
const max_time_step = 1 / 10; // maximum time step for physics
const max_velocity = 3; // maximum velocity of fluid points for numerical stability
const BUFFER = 0.001; // Small buffer to prevent sticking to boundaries
const DAMPING = 0.8; // Velocity damping factor

// POINT VISUALIZATION

// // Try to render them as gaussians
// const texture = createGaussianTexture();

// const test_point_material = new THREE.PointsMaterial({
//     size: 0.2,
//     map: texture,
//     transparent: true,
//     depthWrite: false,  // Helps with blending
//     blending: THREE.AdditiveBlending  // Makes overlapping particles glow
// });

// // let test_fluid_points = Array.from({length: 1000}, () => new THREE.Mesh(fluid_point_geometry, test_point_material));
// const geometry = new THREE.BufferGeometry();

// // create a simple square shape. We duplicate the top left and bottom right
// // vertices because each vertex needs to appear once per triangle.
// const vertices = new Float32Array( [
// 	-1.0, -1.0,  1.0, // v0
// ] );

// // itemSize = 3 because there are 3 values (components) per vertex
// geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
// const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
// const mesh = new THREE.Mesh( geometry, material );

// // // INITIALIZE FLUID AND ADD TO SCENE
// // for(let i=0; i<num_fluid_points; i++) {
// //     test_fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, Math.random()*0.5 + 0.1); // Set position to random in box (0,0,0) - (1,1,1)
// // 	scene.add(test_fluid_points[i]);
// // }

// const test_geometry = new THREE.BufferGeometry();
// const test_positions = new Float32Array(1000 * 3); // 1000 particles, each with x, y, z

// // Fill positions with SPH particle data
// for (let i = 0; i < 1000; i++) {
//     test_positions[i * 3] = Math.random() * 0.3; // x
//     test_positions[i * 3 + 1] = Math.random() * 0.3; // y
//     test_positions[i * 3 + 2] = Math.random() * 0.3; // z
// }

// test_geometry.setAttribute("position", new THREE.BufferAttribute(test_positions, 3));
// const test_points = new THREE.Points(test_geometry, test_point_material);
// scene.add(test_points);

// const test_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: params.point_opacity, transparent: true,});
// const neighbor_material = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: params.point_opacity, transparent: true,});

// OTHER CONSTANTS
const total_volume = 1 * 1 * 1; // volume of the box
const volume_per_particle = total_volume / num_fluid_points; // volume per particle
// const rest_density = params.rest_density_factor * mass / volume_per_particle; // set rest density of the fluid so that it fills specified size in box
// const boundary_density = 0.001; // effective density of boundary used for calculating boundary forces
// **************************************************************************************************

// **************************************************************************************************
// *************************** OBJECT SETUP IN SCENE, INCLUDING BOUNDARY  ***************************
// **************************************************************************************************
// SET UP BOUNDARY BOX
let boundary_geometry = new THREE.BoxGeometry(
  params.boundary_box_width,
  1,
  params.boundary_box_length
);
let boundary_wireframe = new THREE.WireframeGeometry(boundary_geometry);
const line = new THREE.LineSegments(boundary_wireframe);
line.material.depthTest = false;
line.material.opacity = 0.5;
line.material.transparent = true;
line.position.set(
  params.boundary_box_width / 2,
  0.5,
  params.boundary_box_length / 2
);
// scene.add( line );

const wall_color = "rgb(255, 218, 95)"; // Light brown color
const wall_material = new THREE.MeshPhongMaterial({
  color: wall_color,
});

// Load all texture maps
const rockDisplacementScale = 0.3; // how deep the rocks look

const rockTextures = {
  map: textureLoader.load(
    "assets/damp-mossy-boulders-unity/damp-mossy-boulders_albedo.png"
  ),
  normalMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity/damp-mossy-boulders_normal-ogl.png"
  ),
  displacementMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity/damp-mossy-boulders_height.png"
  ),
  roughnessMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity/damp-mossy-boulders_metallic.psd"
  ),
  aoMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity/damp-mossy-boulders_ao.png"
  ),
};

// Configure texture properties
Object.values(rockTextures).forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // Allow infinite scrolling
  texture.repeat.set(4, 4); // Adjust tiling
});

// Create rock material with depth effects
const rockMaterial = new THREE.MeshStandardMaterial({
  map: rockTextures.map,
  normalMap: rockTextures.normalMap,
  displacementMap: rockTextures.displacementMap,
  displacementScale: rockDisplacementScale, // Controls depth intensity
  displacementBias: 0, // Lowers the entire surface so it doesn't "float"
  roughnessMap: rockTextures.roughnessMap,
  aoMap: rockTextures.aoMap,
});

// CREATE SEPARATE TEXTURE FOR THE SIDE WALLS SO CAN SCROLL IN THE Z DIRECTION TOO
const rockTextures_inner = {
  map: textureLoader.load(
    "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_albedo.png"
  ),
  normalMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_normal-ogl.png"
  ),
  displacementMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_height.png"
  ),
  roughnessMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_metallic.psd"
  ),
  aoMap: textureLoader.load(
    "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_ao.png"
  ),
};

// Configure texture properties
Object.values(rockTextures_inner).forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // Allow infinite scrolling
  texture.repeat.set(4, 1); // Adjust tiling
});

// Create rock material with depth effects
const rockMaterial_inner = new THREE.MeshStandardMaterial({
  map: rockTextures_inner.map,
  normalMap: rockTextures_inner.normalMap,
  displacementMap: rockTextures_inner.displacementMap,
  displacementScale: rockDisplacementScale, // Controls depth intensity
  displacementBias: 0, // Lowers the entire surface so it doesn't "float"
  roughnessMap: rockTextures_inner.roughnessMap,
  aoMap: rockTextures_inner.aoMap,
});

function fadeDisplacementEdges(texturePath, callback) {
  const image = new Image();
  image.src = texturePath;
  image.crossOrigin = "anonymous";

  image.onload = function () {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;

    // Draw the original heightmap
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Apply a smooth fade to black near the edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Compute normalized distance from center (for radial fade) or from edges
        const edgeFade = Math.min(
          x / width, // Left fade
          (width - x) / width, // Right fade
          y / height, // Top fade
          (height - y) / height // Bottom fade
        );

        // Smoothly reduce intensity near edges
        const fadeFactor = 1 - Math.pow(2 * edgeFade - 1, 2); // Exponent controls the smoothness of transition at edge
        data[index] *= fadeFactor; // Red (height in grayscale)
        data[index + 1] *= fadeFactor; // Green
        data[index + 2] *= fadeFactor; // Blue
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert the modified canvas into a Three.js texture
    const fadedTexture = new THREE.CanvasTexture(canvas);
    fadedTexture.wrapS = THREE.RepeatWrapping;
    fadedTexture.wrapT = THREE.RepeatWrapping;
    fadedTexture.repeat.set(4, 4); // Adjust tiling
    fadedTexture.needsUpdate = true;

    callback(fadedTexture);
  };
}

fadeDisplacementEdges(
  "assets/damp-mossy-boulders-unity/damp-mossy-boulders_height.png",
  function (fadedTexture) {
    rockMaterial.displacementMap = fadedTexture;
    rockMaterial.displacementMap.needsUpdate = true;
  }
);

fadeDisplacementEdges(
  "assets/damp-mossy-boulders-unity-inner/damp-mossy-boulders_height.png",
  function (fadedTexture) {
    rockMaterial_inner.displacementMap = fadedTexture;
    rockMaterial_inner.displacementMap.needsUpdate = true;
  }
);

const wallDepth = 5; // Thickness of wall extension
const wallHeight = 0.6; // Height of walls (-0.3 to 0.3)
const wallLength = 6; // Extends from z = -3 to z = 3

// Create LEFT WALL (Top-facing and Side-facing)
const rock_wall_buffer = rockDisplacementScale - 0.1;
const leftWallTop = new THREE.Mesh(
  new THREE.PlaneGeometry(wallDepth, wallLength, 100, 100),
  rockMaterial
);
leftWallTop.rotation.x = -Math.PI / 2; // Face upwards
leftWallTop.position.set(-2.5 - rock_wall_buffer, 0.3, 0); // Top of the wall
scene.add(leftWallTop);

// Create RIGHT WALL (Top-facing and Side-facing)
const rightWallTop = new THREE.Mesh(
  new THREE.PlaneGeometry(wallDepth, wallLength, 100, 100),
  rockMaterial
);
rightWallTop.rotation.x = -Math.PI / 2; // Face upwards
rightWallTop.position.set(3.5 + rock_wall_buffer, 0.3, 0);
scene.add(rightWallTop);

const leftWallSide = new THREE.Mesh(
  new THREE.PlaneGeometry(wallLength, wallHeight, 100, 100),
  rockMaterial_inner
); // -> change side material for scrolling / tiling?
leftWallSide.rotation.y = Math.PI / 2; // Face inwards
leftWallSide.position.set(0 - rock_wall_buffer, 0, 0); // Align with side
scene.add(leftWallSide);

const rightWallSide = new THREE.Mesh(
  new THREE.PlaneGeometry(wallLength, wallHeight, 100, 100),
  rockMaterial_inner
);
rightWallSide.rotation.y = -Math.PI / 2; // Face inwards
rightWallSide.rotation.x = Math.PI; // Scroll in correct direction
rightWallSide.position.set(1 + rock_wall_buffer, 0, 0);
scene.add(rightWallSide);

const bottomWall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallDepth, wallLength, 100, 100),
  rockMaterial
);
bottomWall.rotation.x = -Math.PI / 2; // Face upwards
bottomWall.position.set(0.5, -0.3, 0);
scene.add(bottomWall);

// *********************************************************************************

// *********************************************************************************
// GEOMETRY AND MATERIAL
// const fluid_point_geometry = new THREE.SphereGeometry(params.point_radius);
const boundary_point_geometry = new THREE.BoxGeometry(
  params.boundary_point_size,
  params.boundary_point_size,
  params.boundary_point_size
);
// const fluid_material = new THREE.MeshBasicMaterial({ color: 0x1AA9D0, opacity: params.point_opacity, transparent: true,});
const boundary_material = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  opacity: params.boundary_point_opacity,
  transparent: true,
});

// INSTANTIATE THE POINTS
// let fluid_points = Array.from({length: num_fluid_points}, () => new THREE.Mesh(fluid_point_geometry, fluid_material));
let boundary_points = Array.from(
  { length: num_boundary_particles },
  () => new THREE.Mesh(boundary_point_geometry, boundary_material)
);

// // INITIALIZE FLUID AND ADD TO SCENE
// for(let i=0; i<num_fluid_points; i++) {
//     fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, Math.random()*0.5 + 0.1); // Set position to random in box (0,0,0) - (1,1,1)
// 	scene.add(fluid_points[i]);
// }

// Create a shared material for all particles
const gaussianTexture = createGaussianTexture(
  colorParams.r,
  colorParams.g,
  colorParams.b
);
const fluid_material = new THREE.SpriteMaterial({
  map: gaussianTexture,
  // color: water_color,
  opacity: params.point_opacity,
  transparent: true,
  depthWrite: false, // Avoid depth conflicts
  premultipliedAlpha: false,
  blending: THREE.AdditiveBlending, // Smooth blending between particles
});
updateFluidColor();

// Create sprite-based fluid points
let fluid_points = Array.from(
  { length: num_fluid_points },
  () => new THREE.Sprite(fluid_material)
);

// INITIALIZE FLUID AND ADD TO SCENE
for (let i = 0; i < num_fluid_points; i++) {
  fluid_points[i].scale.set(
    params.point_radius * 2,
    params.point_radius * 2,
    1
  ); // Scale sprite to match sphere size
  fluid_points[i].position.set(
    Math.random() * 0.3 + 0.5,
    Math.random() * 0.4 + 0.2,
    Math.random() * 1 + 1.5
  );
  scene.add(fluid_points[i]);
}

// STATIONARY POINTS THAT MAKE FLUID LOOK LIKE EXTENDS LONGER
const num_below_box = 1000;
const num_behind_box = 0;
const numStationaryPoints = num_below_box + num_behind_box;
const stationary_points = [];

for (let i = 0; i < numStationaryPoints; i++) {
  const sprite = new THREE.Sprite(fluid_material);
  sprite.scale.set(params.point_radius * 2, params.point_radius * 2, 1); // Scale sprite to match sphere size

  // Randomly distribute points within the given range
  // below box
  const x = Math.random() * 1;
  let y = Math.random() * 0.2 - 0.2;
  let z = Math.random() * 3;

  // behind box
  if (i > num_below_box) {
    y = Math.random() * 0.2; // -0.3 to 0
    z = Math.random() * 6 - 6; // 0 to 3
  }

  sprite.position.set(x, y, z);

  scene.add(sprite);
  stationary_points.push(sprite);
}

// Create mirrored fluid points array
let mirror_points = fluid_points.map((original) => {
  const mirrored = new THREE.Sprite(fluid_material);
  mirrored.scale.set(params.point_radius * 2, params.point_radius * 2, 1); // Scale sprite to match sphere size
  mirrored.position.set(
    original.position.x,
    original.position.y,
    -original.position.z
  ); // Mirror across z-axis
  scene.add(mirrored);
  return mirrored;
});

// Update mirrored positions every frame
function updateMirroredPoints() {
  for (let i = 0; i < fluid_points.length; i++) {
    mirror_points[i].position.set(
      fluid_points[i].position.x,
      fluid_points[i].position.y,
      -fluid_points[i].position.z // Mirror Z-axis
    );
  }
}

// INITIALIZE BOUNDARY POINTS AND ADD TO SCENE
const num_points_per_side = num_boundary_particles / 3;
set_up_boundary_points(num_points_per_side, true);
// ************************************************************************************

// ************************************************************************************
// ****************************** GUI FOR TESTING VALUES ******************************
// ************************************************************************************
const gui = new dat.GUI();

// POINT VISUALIZATION
const VisualsFolder = gui.addFolder("Fluid Visuals");
VisualsFolder.add(params, "point_radius", 0.005, 0.2)
  .name("Point Radius")
  .onChange((newRadius) => {
    //     fluid_points.forEach((sphere) => {
    //         sphere.geometry.dispose(); // Dispose old geometry
    //         sphere.geometry = new THREE.SphereGeometry(newRadius); // Create new geometry
    //     });
    // });
    fluid_points.forEach((point) => {
      point.scale.set(newRadius * 2, newRadius * 2, 1); // Scale sprite to match sphere size
    });
    mirror_points.forEach((point) => {
      point.scale.set(newRadius * 2, newRadius * 2, 1); // Scale sprite to match sphere size
    });
    stationary_points.forEach((point) => {
      point.scale.set(newRadius * 2, newRadius * 2, 1); // Scale sprite to match sphere size
    });
  });
VisualsFolder.add(fluid_material, "opacity", 0, 1).name("Point Opacity");
VisualsFolder.add(params, "show_neighbor_search").name("Show Neighbor Search?");

// Function to update material color
function updateFluidColor() {
  const { r, g, b } = colorParams;
  fluid_material.color.setRGB(r, g, b);
  fluid_material.map = createGaussianTexture(r, g, b);
  fluid_material.needsUpdate = true;
}

// Add RGB sliders to GUI
VisualsFolder.add(colorParams, "r", 0, 1)
  .name("fluid R")
  .onChange(updateFluidColor);
VisualsFolder.add(colorParams, "g", 0, 1)
  .name("fluid G")
  .onChange(updateFluidColor);
VisualsFolder.add(colorParams, "b", 0, 1)
  .name("fluid B")
  .onChange(updateFluidColor);

VisualsFolder.open();

// BOUNDARY VISUALIZATION
const BoundaryFolder = gui.addFolder("Boundaries");
BoundaryFolder.add(params, "boundary_box_width", 0.1, 1)
  .name("Box Width")
  .onChange((newSize) => {
    // initialize at max in GUI as I don't want to update hashing declaration yet
    line.geometry.dispose();
    boundary_geometry = new THREE.BoxGeometry(
      newSize,
      1,
      params.boundary_box_length
    );
    boundary_wireframe = new THREE.WireframeGeometry(boundary_geometry);
    line.geometry = boundary_wireframe;
    line.position.set(newSize / 2, 0.5, params.boundary_box_length / 2);
    // set_up_boundary_points(num_points_per_side);
  });
BoundaryFolder.add(params, "boundary_box_length", 0.1, 3)
  .name("Box Length")
  .onChange((newSize) => {
    // initialize at max in GUI as I don't want to update hashing declaration yet
    line.geometry.dispose();
    boundary_geometry = new THREE.BoxGeometry(
      params.boundary_box_width,
      1,
      newSize
    );
    boundary_wireframe = new THREE.WireframeGeometry(boundary_geometry);
    line.geometry = boundary_wireframe;
    line.position.set(params.boundary_box_width / 2, 0.5, newSize / 2);
    // set_up_boundary_points(num_points_per_side);
  });
// BoundaryFolder.add(params, "boundary_point_size", 0.001, 0.05).name('Point Size').onChange((newSize) => {
//     boundary_points.forEach((boundary_box) => {
//         boundary_box.geometry.dispose(); // Dispose old geometry
//         boundary_box.geometry = new THREE.BoxGeometry(newSize, newSize, newSize); // Create new geometry
//     });
// });
// BoundaryFolder.add(boundary_material, "opacity", 0, 1).name('Point Opacity');
BoundaryFolder.open();

// FLUID PROPERTIES
const FluidFolder = gui.addFolder("Fluid Properties");
FluidFolder.add(params, "stiffness", 0.05, 5).name("stiffness");
FluidFolder.add(params, "viscosity", 0, 700).name("viscosity");
FluidFolder.add(params, "smoothing_radius", 0.02, 0.5).name("smoothing_radius");
FluidFolder.add(params, "grav_strength", 0, 10).name("grav_strength");
FluidFolder.add(params, "rest_density_factor", 0.6, 5).name("Rest Density");
FluidFolder.open();

// BUOYANCY PROPERTIES
const BuoyancyFolder = gui.addFolder("Buoyancy Properties");
BuoyancyFolder.add(params, "buoyancy_strength", 0.1, 5).name(
  "Buoyancy Strength"
);
BuoyancyFolder.add(params, "buoyancy_sample_points", 1, 100)
  .name("Sample Points")
  .step(1);
BuoyancyFolder.add(params, "show_water_level").name("Show Water Level");
BuoyancyFolder.open();

// OBJECT INTERACTION PROPERTIES
const ObjectInteractionFolder = gui.addFolder("Object Interactions");
ObjectInteractionFolder.add(
  params,
  "object_interaction_strength",
  0.01,
  1
).name("strength");
ObjectInteractionFolder.add(params, "interaction_length_scale", 0.5, 2).name(
  "distance"
);
ObjectInteractionFolder.open();
// *********************************************************************************

// **************************************************************************************************
// *********************************** GLOBAL VARIABLES TO UPDATE ***********************************
// **************************************************************************************************
// TIME
let dt;
const clock = new THREE.Clock();
let last_time_spatial_lookup_updated = -1;
const update_delay = 0.1; // how long to wait before updating the spatial lookup array

// ARRAYS
let density = Array.from({ length: num_points }, (v, i) =>
  i < num_fluid_points ? 0 : rest_density()
); // density of each point
let pressure_acceleration = Array.from(
  { length: num_fluid_points },
  () => new THREE.Vector3(0, 0, 0)
); // negative gradient of pressure / density, with simple eqn of state p = k * (rho - rho_0)
let particle_velocity = Array.from(
  { length: num_fluid_points },
  () => new THREE.Vector3(0, 0, 0)
);
let mass_array = Array.from({ length: num_points }, (v, i) =>
  i < num_fluid_points ? mass : mass_boundary
);
let predicted_positions = Array.from(
  { length: num_fluid_points },
  () => new THREE.Vector3(0, 0, 0)
);

let spatial_lookup = Array.from({ length: num_fluid_points }, () => [0, 0]); // entries are [particle_index, cell_key]
const maxInt = Number.MAX_SAFE_INTEGER;
let start_indices = Array.from({ length: num_fluid_points }, () => maxInt); // entry i (particle index) indicates where corresponding cell begins indexing in spatial_lookup
// **************************************************************************************************

// *********************************************************************************************
// **************************************** RENDER LOOP ****************************************
// *********************************************************************************************
function animate() {
  stats.begin(); // FPS counter
  renderer.render(scene, camera);
  stats.end(); // FPS counter
  controls.update();

  // update time and delta_t
  // dt = clock.getDelta(); // get time since last frame
  dt = Math.min(clock.getDelta(), max_time_step); // make sure physics time step is sufficiently small
  animation_time += dt;
  // wall_uniforms.animation_time.value = animation_time;

  // Update the spatial_lookup array
  if (animation_time - last_time_spatial_lookup_updated > update_delay) {
    update_spatial_lookup(); // DO THIS FOR EVERY FRAME ? pretty slow.. try doing every <last_time_spatial_lookup_updated> seconds
    last_time_spatial_lookup_updated = animation_time;
  }

  // *********** VISUALLY VERIFYING THAT THE NEIGHBOR SEARCH ALGORITHM WORKS ****************
  show_neighbor_searching();
  // ****************************************************************************************

  // predict positions
  for (let i = 0; i < num_fluid_points; i++) {
    predicted_positions[i] = fluid_points[i].position
      .clone()
      .add(particle_velocity[i].clone().multiplyScalar(dt));
  }

  // const current_positions = fluid_points.map(p => p.position.clone());
  compute_density(predicted_positions);

  // compute total force on each FLUID particle (boundary particles stationary)
  for (let i = 0; i < num_fluid_points; i++) {
    // FIRST UPDATE VELOCITY WITH VISCOSITY AND GRAVITY
    const a_grav = compute_gravity_force(fluid_points[i].position.clone()); // GRAVITATIONAL FORCE
    const a_viscosity = compute_viscosity_force(i); // viscosity FORCE
    // const a_boundary = compute_boundary_force(fluid_points[i].position.clone()); // BOUNDARY FORCE - try to enforce stronger boundary conditions
    // determine forces due to interaction with objects
    const a_object_interaction = compute_object_interaction_acceleration(i);

    const dv0 = a_grav
      .clone()
      .add(a_viscosity.add(a_object_interaction))
      .multiplyScalar(dt); // .add(a_boundary)
    particle_velocity[i].add(dv0);
    particle_velocity[i] = clamp_velocity(particle_velocity[i]);
    // predicted_positions[i] = fluid_points[i].position.clone().add( velocity[i].clone().multiplyScalar(dt) );

    compute_pressure_acceleration(i, predicted_positions);

    // ------- update velocity ----------
    // fluid_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) ); // go back to before prediction
    // all_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) );
    particle_velocity[i].add(
      pressure_acceleration[i].clone().multiplyScalar(dt)
    ); // add
    particle_velocity[i] = clamp_velocity(particle_velocity[i]);

    // update position
    const dx = particle_velocity[i].clone().multiplyScalar(dt);
    fluid_points[i].position.add(dx);
    // all_points[i].position.add( dx );

    // check for NaNs and handle boundary collisions
    particle_velocity[i] = clamp_velocity(particle_velocity[i]);
    validateParticlePosition(fluid_points[i].position, i);

    handleBoundaryCollisions(i);

    // // PERIODIC BOUNDARY CONDITIONS - doesn't compute forces due to peroidicity
    // fluid_points[i].position.x = (fluid_points[i].position.x + 1) % 1;
    // all_points[i].position.x = (all_points[i].position.x + 1) % 1;
    // fluid_points[i].position.y = (fluid_points[i].position.y + 1) % 1;
    // all_points[i].position.y = (all_points[i].position.y + 1) % 1;
  }
  // current_positions = updated_positions;
  updateMirroredPoints();

  if (playerCollisionMesh) {
    if (keys.w && !isRocking) {
      boatVelocity += ACCELERATION;
      player.position.y -= VERTICAL_SPEED;
      playerCollisionMesh.position.y -= VERTICAL_SPEED;
    }
    if (keys.s && !isRocking) {
      boatVelocity -= ACCELERATION;
      player.position.y -= VERTICAL_SPEED;
      playerCollisionMesh.position.y -= VERTICAL_SPEED;
    }
    if (keys.a && !isRocking) {
      player.rotation.z += ROTATION_SPEED;
      playerCollisionMesh.rotation.y += ROTATION_SPEED;
      boatDirection.applyAxisAngle(worldUp, ROTATION_SPEED);
      boatBBOffset.applyAxisAngle(worldUp, ROTATION_SPEED);
    }
    if (keys.d && !isRocking) {
      player.rotation.z -= ROTATION_SPEED;
      playerCollisionMesh.rotation.y -= ROTATION_SPEED;
      boatDirection.applyAxisAngle(worldUp, -ROTATION_SPEED);
      boatBBOffset.applyAxisAngle(worldUp, -ROTATION_SPEED);
    }
    if (keys[" "] && !isRocking) {
      player.position.y += VERTICAL_SPEED;
      playerCollisionMesh.position.y += VERTICAL_SPEED;
    }
    if (keys.shift && !isRocking) {
      player.position.y -= VERTICAL_SPEED;
      playerCollisionMesh.position.y -= VERTICAL_SPEED;
    }

    boatVelocity *= FRICTION;

    const buoyancyForce = calculateBuoyancyForce(
      playerCollisionMesh.position,
      boatBBDimensions
    );
    player.position.y += buoyancyForce.y * 0.001;
    playerCollisionMesh.position.y += buoyancyForce.y * 0.001;

    player.position.y -= params.grav_strength * 0.005;
    playerCollisionMesh.position.y -= params.grav_strength * 0.005;

    player.position.addScaledVector(boatDirection, boatVelocity);
    playerCollisionMesh.position.copy(player.position).add(boatBBOffset);

    for (const obstacle of obstaclesArr) {
      toObstacle.subVectors(obstacle.position, playerCollisionMesh.position);
      if (
        toObstacle.lengthSq() <
        COLLISION_CHECK_RADIUS * COLLISION_CHECK_RADIUS
      ) {
        const collision = checkCollision(playerCollisionMesh, obstacle);
        if (collision) {
          if (toObstacle.dot(collision.minAxis) > 0) collision.minAxis.negate();
          player.position.addScaledVector(
            collision.minAxis,
            collision.minOverlap
          );
          playerCollisionMesh.position.copy(player.position).add(boatBBOffset);
          if (!isRocking && !hasImmunity) animateRocking();
          boatVelocity = 0;
        }
      }
    }

    controls.target.copy(player.position);
  }

  if (boat && heart && power) {
    // BOAT MOVEMENT
    if (movement.left) {
      if (boat.rotation.z < 1) {
        boat.rotation.z += angularAcceleration;
        direction.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          angularAcceleration
        );
      }
    }
    if (movement.right) {
      if (boat.rotation.z > -1) {
        boat.rotation.z -= angularAcceleration;
        direction.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          -angularAcceleration
        );
      }
    }
    if (movement.forward)
      velocity = Math.min(velocity + acceleration, maxSpeed);
    if (movement.brake) velocity *= friction;
    if (!movement.forward && !movement.brake) {
      velocity *= friction; // Apply friction only when no input is given
    }
    let movementVector = direction.clone().multiplyScalar(velocity);
    // 🎯 Split movement into X and Z components
    let movementX = new THREE.Vector3(movementVector.x, 0, 0); // Forward/backward
    let movementZ = new THREE.Vector3(0, 0, movementVector.z); // Left/rightw

    let newBoatPosition = boat.position.clone().add(movementZ);
    newBoatPosition.z = THREE.MathUtils.clamp(
      newBoatPosition.z,
      poolBoundaries.minZ * 0.9,
      poolBoundaries.maxZ * 0.9
    );
    boat.position.copy(newBoatPosition);

    // 🎯 Apply X-movement (forward/backward) to obstacles/objects in reverse
    if (heart) heart.position.sub(movementX);
    if (power) power.position.sub(movementX);
    for (let i = activeObstacles.length - 1; i >= 0; i--) {
      let obstacle = activeObstacles[i];
      obstacle.position.sub(movementX); // Move obstacles in opposite X direction

      if (obstacle.position.x < -0.5) {
        // If past the boat
        obstacle.visible = false;
        obstacle.position.set(0, 10, 0); // Hide it
        activeObstacles.splice(i, 1); // Remove from active list
        unusedObstacles.push(obstacle); // Add back to unused pool
      }

      obstacle.updateMatrixWorld(true); // Force update

      let detectionRange = 0.08;
      if (boat.position.distanceTo(obstacle.position) < detectionRange) {
        //simple position based collision detect
        console.log("hit");
        handleBoatCollision();
      }
    }

    if (boat.position.distanceTo(heart.position) < 0.08) {
      text = "Life+1";
      setTimeout(() => {
        text = "";
      }, 1000);
      heart.position.set(0, 10, 0); // Hide it
      heart.visible = false;
      boatLives++; // 🎯 Increase life
    }

    if (boat.position.distanceTo(power.position) < 0.08) {
      text = "Rush!!Just keep going forward!";
      setTimeout(() => {
        text = "";
      }, 10000);
      power.position.set(0, 10, 0); // Hide it
      power.visible = false;

      // 🎯 Apply power-up effect
      maxSpeed *= 2; // 🚀 Double acceleration
      acceleration *= 2; // 🚀 Double acceleration
      isImmune = true;
      setTimeout(() => {
        maxSpeed /= 2;
        acceleration /= 2;
        isImmune = false;
      }, 10000);
    }
    // 🎯 Detect Level
    distanceTraveled += movementX.x;
    if (distanceTraveled >= levelTreshold) {
      level++; // Increase level
      resetLevel();
    }

    if (unusedObstacles.length > 10) {
      respawnObstacles();
    }

    // 🎯 **Update HUD Text**
    // document.getElementById("directionText").innerText =
    // `Life: ${boatLives}\n` +
    // `Level: ${level}\n` +
    // `Distance till exit: ${(levelTreshold-distanceTraveled).toFixed(1)}\n`
    // ;

    // 🎯 **Update Centered Text**
    // document.getElementById("centerText").innerText = text;
    // document.getElementById("centerText").style.display = text ? "block" : "none"; // Show if text is not empty
    // `Score: ${score}\n` +
    // `Position: (${boat.position.x.toFixed(2)}, ${boat.position.y.toFixed(2)}, ${boat.position.z.toFixed(2)})\n` +
    // `Velocity: ${velocity.toFixed(2)}`;

    // 🎥 **Handle Free Camera Mode**   // could be deleted in the end
    if (movement.freeCamera) {
      // Move the camera to (0,10,0) and make it look at the boat
      camera.lookAt(boat.position);
    } else {
      // 🎯 **Make Camera Look Ahead in Boat’s Moving Direction**
      const lookAhead = boat.position
        .clone()
        .add(direction.clone().multiplyScalar(10));
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
renderer.setAnimationLoop(animate);
// **************************************************************************************************

// ************************************ KEYBOARD INTERACTION ****************************************
const moveSpeed = 0.03;

// Function to smoothly update obstacle positions
function updateObstacles() {
  let moveX = 0;
  let moveZ = 0;

  if (keys.w) moveZ -= moveSpeed; // Move forward
  if (keys.s) moveZ += moveSpeed; // Move backward
  if (keys.a) moveX -= moveSpeed; // Move left
  if (keys.d) moveX += moveSpeed; // Move right

  // Apply movement to all obstacle objects
  if (moveX !== 0 || moveZ !== 0) {
    for (let i = 0; i < obstacle_objects_in_scene.length; i++) {
      obstacle_objects_in_scene[i].position.x += moveX;
      obstacle_objects_in_scene[i].position.z += moveZ;
    }
    // Scroll wall texture in the +z direction at the same rate
    const scroll_speed = moveSpeed * 23; // Adjust scroll speed

    // top facing wall material scroll
    rockMaterial.map.offset.y += moveZ * scroll_speed;
    rockMaterial.normalMap.offset.y += moveZ * scroll_speed;
    rockMaterial.displacementMap.offset.y += moveZ * scroll_speed;
    rockMaterial.roughnessMap.offset.y += moveZ * scroll_speed;
    rockMaterial.aoMap.offset.y += moveZ * scroll_speed;

    // side facing wall material scroll
    rockMaterial_inner.map.offset.x += moveZ * scroll_speed;
    rockMaterial_inner.normalMap.offset.x += moveZ * scroll_speed;
    rockMaterial_inner.displacementMap.offset.x += moveZ * scroll_speed;
    rockMaterial_inner.roughnessMap.offset.x += moveZ * scroll_speed;
    rockMaterial_inner.aoMap.offset.x += moveZ * scroll_speed;
  }

  requestAnimationFrame(updateObstacles); // Keep updating smoothly
}

// Start the movement update loop
updateObstacles();

// **************************************************************************************************

// **************************************************************************************************
// **************************************** HELPER FUNCTIONS ****************************************
// **************************************************************************************************

const volume = (Math.PI * Math.pow(params.smoothing_radius, 4)) / 6; // 2D kernel volume
function kernel2D(dist) {
  if (dist >= params.smoothing_radius) {
    return 0;
  }
  return (
    ((params.smoothing_radius - dist) * (params.smoothing_radius - dist)) /
    volume
  );
}

const scale = 12 / (Math.pow(params.smoothing_radius, 4) * Math.PI);
function kernel2D_deriv(dist) {
  if (dist >= params.smoothing_radius) {
    return 0;
  }
  return (dist - params.smoothing_radius) * scale;
}

function rest_density() {
  return (params.rest_density_factor * mass) / volume_per_particle;
}

// const test_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: params.point_opacity, transparent: true,});
// const neighbor_material = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: params.point_opacity, transparent: true,});

const test_material = new THREE.SpriteMaterial({
  map: gaussianTexture,
  color: 0xff0000, // Keep your fluid color
  opacity: 1,
  transparent: true,
  depthWrite: false, // Avoid depth conflicts
  blending: THREE.AdditiveBlending, // Smooth blending between particles
});

const neighbor_material = new THREE.SpriteMaterial({
  map: gaussianTexture,
  color: 0xffff00, // Keep your fluid color
  opacity: 1,
  transparent: true,
  depthWrite: false, // Avoid depth conflicts
  blending: THREE.AdditiveBlending, // Smooth blending between particles
});

function show_neighbor_searching() {
  // first make all same color, then modify
  for (let i = 0; i < num_fluid_points; i++) {
    fluid_points[i].material = fluid_material;
  }

  if (params.show_neighbor_search == true) {
    const test_ind = 0;

    // make test point red
    fluid_points[test_ind].material = test_material;

    // make neighbor points yellow
    const test_point = fluid_points[test_ind].position.clone();
    for (const neighbor_idx of get_neighbor_indices(test_point)) {
      if (neighbor_idx == test_ind) {
        continue;
      }
      fluid_points[neighbor_idx].material = neighbor_material;
    }
  }
}

// // density correction factor (one layer boundary) for a specified fluid particle
// function density_correction_factor(particle_index) {
//     let fluid_particle_sum = 0;
//     let boundary_particle_sum = 0;

//     // fluid particle sum
//     for (let i=0; i < num_fluid_points; i++) {
//         const dist = fluid_points[particle_index].position.clone().distanceTo(fluid_points[i].position.clone());
//         const kernel_value = kernel2D(dist);
//         fluid_particle_sum += kernel_value;
//     }
//     //boundary particle sum
//     for (let i=num_fluid_points; i < num_points; i++) {
//         const dist = fluid_points[particle_index].position.clone().distanceTo(all_points[i].position.clone());
//         const kernel_value = kernel2D(dist);
//         boundary_particle_sum += kernel_value;
//     }

//     return (1 / volume_per_particle - fluid_particle_sum) / boundary_particle_sum;
// }

// turn off gravity at boundary
function compute_gravity_force(current_position) {
  const norm_pos = current_position.clone().divideScalar(1); // currently box of size 1
  const y_force =
    norm_pos.y > 0
      ? -params.grav_strength *
        (1 - Math.exp(-grav_drop_off_strength * (norm_pos.y - 0.03)))
      : 0;
  // const y_force = - params.grav_strength;
  return new THREE.Vector3(0, y_force, 0);
}

// // function to compute boundary force
// function compute_boundary_force(current_position) {
//     const norm_pos = current_position.clone().divideScalar(1); // currently box of size 1
//     // const x_force = 1 / ( Math.sin(Math.PI * norm_pos.x)**2 * Math.tan(Math.PI * norm_pos.x) );
//     // const y_force = 1 / ( Math.sin(Math.PI * norm_pos.y)**2 * Math.tan(Math.PI * norm_pos.y) );
//     const x_force = -Math.sinh(10 * (norm_pos.x - 0.5));
//     const y_force = -Math.sinh(10 * (norm_pos.y - 0.5));
//     return new THREE.Vector3(x_force, y_force, 0).multiplyScalar(boundary_force_strength / mass);
// }

function compute_viscosity_force(particle_index) {
  let viscosity_force = new THREE.Vector3(0, 0, 0);
  const current_position = fluid_points[particle_index].position.clone();

  // fluid contribution
  for (const j of get_neighbor_indices(current_position)) {
    if (j == particle_index) {
      continue;
    }

    const j_to_i = fluid_points[j].position.clone().sub(current_position);
    const dist = j_to_i.length();
    const kernel_deriv = kernel2D_deriv(dist);
    const velocity_diff = particle_velocity[particle_index]
      .clone()
      .sub(particle_velocity[j].clone());
    // params.viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
    // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));

    // original lapalacian formulation
    viscosity_force.add(
      velocity_diff.multiplyScalar(
        ((-mass_array[j] / density[j]) *
          Math.abs(kernel_deriv / Math.max(dist, min_separation)) *
          params.viscosity) /
          density[particle_index]
      )
    );

    // // simplified (linear) velocity smoothing - does not work much better
    // const kernel = kernel2D( dist );
    // viscosity_force.add( velocity_diff.multiplyScalar(- params.viscosity * mass_array[j] / density[j] * kernel / 100) );
  }

  // boundary contribution
  for (let j = 0; j < num_boundary_particles; j++) {
    const j_to_i = boundary_points[j].position.clone().sub(current_position);
    const dist = j_to_i.length();
    const kernel_deriv = kernel2D_deriv(dist);
    const velocity_diff = particle_velocity[particle_index].clone(); // boundary point stationary
    // viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
    // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
    viscosity_force.add(
      velocity_diff.multiplyScalar(
        ((-mass_array[j] / density[j]) *
          Math.abs(kernel_deriv / Math.max(dist, min_separation)) *
          params.viscosity) /
          density[particle_index]
      )
    );
  }
  return viscosity_force;
}

// ********** COMPUTE DENSITY -- density computed for FLUID points only (boundary set to rest density) **********
function compute_density(fluid_positions_arg) {
  const density_at_rest = rest_density();
  // compute FLUID density rho_i at point x_i due to all points
  for (let i = 0; i < num_fluid_points; i++) {
    density[i] = density_at_rest; // ** VERY IMPORTANT ** -- reset density to REST density of fluid before computing

    // density correction factor for this specific fluid particle to account for one layer of boundary particles
    // const boundary_correction_factor = density_correction_factor(i); // seems to be causing instability
    const boundary_correction_factor = mass_boundary / mass;

    // fluid contribution
    for (const j of get_neighbor_indices(fluid_positions_arg[i])) {
      if (j == i) {
        continue;
      }

      const dist = fluid_positions_arg[i].distanceTo(fluid_positions_arg[j]);
      const kernel_value = kernel2D(dist);
      density[i] += mass * kernel_value;
    }

    // boundary contribution
    for (let j = 0; j < num_boundary_particles; j++) {
      const dist = fluid_positions_arg[i].distanceTo(
        boundary_points[j].position.clone()
      );
      const kernel_value = kernel2D(dist);
      density[i] += boundary_correction_factor * mass * kernel_value;
    }

    if (clamp_density == true) {
      density[i] = Math.max(density[i], density_at_rest); // help the particle deficiency problem at free surface
    }
    // // Protect against too low density - does not help with stability
    // const min_density = rest_density * 0.1;
    // density[i] = Math.max(density[i], min_density);
  }
}

function compute_pressure_acceleration(i, positions_array) {
  // PRESSURE FORCE: compute gradient of pressure to get acceleration due to pressure -- assumes equation of state p = k * (rho - rho_0)
  pressure_acceleration[i].set(0, 0, 0);
  // const current_position = fluid_points[i].position.clone();
  const current_position = positions_array[i].clone();

  // fluid contribution
  for (const j of get_neighbor_indices(current_position)) {
    // ** may need to change get_neighbor_indices to calculate based on predicted positions
    if (j == i) {
      continue;
    }

    // const j_to_i = current_position.clone().sub(fluid_points[j].position.clone());
    const j_to_i = current_position.clone().sub(positions_array[j].clone());
    const dist = j_to_i.length();
    const kernel_deriv = kernel2D_deriv(dist);

    const pressure_acc = j_to_i.multiplyScalar(
      ((-params.stiffness * kernel_deriv) / Math.max(dist, min_separation)) *
        mass_array[j] *
        (1 / density[i] + 1 / density[j])
    );

    // pressure_acceleration[i].add( - params.stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
    pressure_acceleration[i].add(pressure_acc);
    // pressure_acceleration[i].set(0,0.01,0);
  }

  // boundary contribution
  for (let j = 0; j < num_boundary_particles; j++) {
    const j_to_i = current_position
      .clone()
      .sub(boundary_points[j].position.clone());
    const dist = j_to_i.length();
    const kernel_deriv = kernel2D_deriv(dist);

    const pressure_acc = j_to_i.multiplyScalar(
      ((-params.stiffness * kernel_deriv) / Math.max(dist, min_separation)) *
        mass_boundary *
        (2 / density[i])
    ); // approximate boundary with same density as fluid near boundary

    // pressure_acceleration[i].add( - params.stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
    pressure_acceleration[i].add(pressure_acc);
    // pressure_acceleration[i].set(0,0.01,0);
  }
}

// clamp max velocity to help with numerical stability?
function clamp_velocity(particle_velocity) {
  if (particle_velocity.length() > max_velocity) {
    particle_velocity.normalize().multiplyScalar(max_velocity);
  }
  return particle_velocity;
}

function validateParticlePosition(position, i) {
  if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
    console.warn(`Invalid position detected for particle ${i}`);
    position.set(0.5, 1, 0);
    return false;
  }
  return true;
}

function handleBoundaryCollisions(i) {
  // x = 0
  if (fluid_points[i].position.x < 0 + BUFFER) {
    fluid_points[i].position.x = 0 + BUFFER;
    // all_points[i].position.x = 0 + BUFFER;
    particle_velocity[i].x = Math.abs(particle_velocity[i].x) * DAMPING;
  }
  // x = boundary_box_width
  if (fluid_points[i].position.x > params.boundary_box_width - BUFFER) {
    fluid_points[i].position.x = params.boundary_box_width - BUFFER;
    // all_points[i].position.x = 1 - BUFFER;
    particle_velocity[i].x = -Math.abs(particle_velocity[i].x) * DAMPING;
  }
  // y = 0
  if (fluid_points[i].position.y < 0 + BUFFER) {
    fluid_points[i].position.y = 0 + BUFFER;
    // all_points[i].position.y = 0 + BUFFER;
    particle_velocity[i].y = Math.abs(particle_velocity[i].y) * DAMPING;
  }
  // y = 1
  if (fluid_points[i].position.y > 1 - BUFFER) {
    fluid_points[i].position.y = 1 - BUFFER;
    // all_points[i].position.y = 1 - BUFFER;
    particle_velocity[i].y = -Math.abs(particle_velocity[i].y) * DAMPING;
  }
  // z = 0
  if (fluid_points[i].position.z < 0 + BUFFER) {
    fluid_points[i].position.z = 0 + BUFFER;
    particle_velocity[i].z = Math.abs(particle_velocity[i].z) * DAMPING;
  }
  // z = params.boundary_box_length
  if (fluid_points[i].position.z > params.boundary_box_length - BUFFER) {
    fluid_points[i].position.z = params.boundary_box_length - BUFFER;
    particle_velocity[i].z = -Math.abs(particle_velocity[i].z) * DAMPING;
  }

  // TRY PERIODIC BOUNDARY CONDITIONS - does not work well in neighbor lookup and would have to modify distance calculation in all calculate force functions
  // fluid_points[i].position.z = (fluid_points[i].position.z + 1) % 1;
  // fluid_points[i].position.x = (fluid_points[i].position.x + 1) % 1;

  // // Add box in middle of fluid
  // const box_x_start = 0;
  // const box_x_end = 0.2;

  // if (fluid_points[i].position.x > box_x_start && fluid_points[i].position.x < box_x_end && fluid_points[i].position.z > box_x_start && fluid_points[i].position.z < box_x_end) {
  //     // modify x value
  //     if (fluid_points[i].position.x - box_x_start > box_x_end - fluid_points[i].position.x) {
  //         // put velocity towards -x
  //         fluid_points[i].position.x = box_x_start - BUFFER;
  //         velocity[i].x = -Math.abs(velocity[i].x) * DAMPING;
  //     }
  //     else {
  //         fluid_points[i].position.x = box_x_end + BUFFER;
  //         velocity[i].x = Math.abs(velocity[i].x) * DAMPING;
  //     }
  //     // modify z value
  //     if (fluid_points[i].position.z - box_x_start > box_x_end - fluid_points[i].position.z) {
  //         fluid_points[i].position.z = box_x_start - BUFFER;
  //         velocity[i].z = -Math.abs(velocity[i].z) * DAMPING;
  //     }
  //     else {
  //         fluid_points[i].position.z = box_x_end + BUFFER;
  //         velocity[i].z = Math.abs(velocity[i].z) * DAMPING;
  //     }

  //     // all_points[i].position.x = 0 + BUFFER;
  //     // velocity[i].x = velocity[i].x * 0.;
  // }
}

function set_up_boundary_points(num_points_per_side, add_to_scene = false) {
  const width = params.boundary_box_width + 2 * boundary_buffer;
  const z_height = 1 + 2 * boundary_buffer;
  for (let i = 0; i < num_boundary_particles; i++) {
    // y = 0 boundary
    if (i >= 0 && i < num_points_per_side) {
      boundary_points[i].position.set(
        ((i % num_points_per_side) / num_points_per_side) * width -
          boundary_buffer,
        -boundary_buffer,
        0
      );
    }
    // x = params.boundary_box_width boundary
    else if (i >= num_points_per_side && i < 2 * num_points_per_side) {
      boundary_points[i].position.set(
        params.boundary_box_width + boundary_buffer,
        ((i % num_points_per_side) / num_points_per_side) * z_height -
          boundary_buffer,
        0
      );
    }
    // x = 0 boundary
    else if (i >= 2 * num_points_per_side && i < 3 * num_points_per_side) {
      boundary_points[i].position.set(
        -boundary_buffer,
        ((i % num_points_per_side) / num_points_per_side) * z_height -
          boundary_buffer,
        0
      );
    }
    if (add_to_scene == true) {
      scene.add(boundary_points[i]);
    }
  }
}

function calculateBuoyancyForce(boatPosition, boatDimensions) {
  const waterHeight = calculateWaterHeight();
  const boatBottomHeight = boatPosition.y - boatDimensions.y / 2;

  if (params.show_water_level) {
    waterLevelMesh.position.set(boatPosition.x, waterHeight, boatPosition.z);
    waterLevelMesh.visible = true;
  } else waterLevelMesh.visible = false;

  const baseArea = boatDimensions.x * boatDimensions.z;
  const submergedDepth = Math.max(
    0,
    Math.min(waterHeight - boatBottomHeight, boatDimensions.y)
  );
  const submergedVolume = baseArea * submergedDepth;

  const buoyancyMagnitude =
    rest_density() *
    params.grav_strength *
    submergedVolume *
    params.buoyancy_strength;
  return new THREE.Vector3(0, buoyancyMagnitude, 0);
}

function calculateWaterHeight() {
  const distances = fluid_points.sort(
    (a, b) =>
      a.position.distanceTo(playerCollisionMesh.position) -
      b.position.distanceTo(playerCollisionMesh.position)
  );
  const numSamples = Math.min(params.buoyancy_sample_points, distances.length);

  let totalHeight = 0;
  for (let i = 0; i < numSamples; i++) totalHeight += distances[i].position.y;

  return totalHeight / numSamples;
}

// ******************************** EFFICIENT NEIGHBOR SEARCH FUNCTIONS ************************************
// convert 3D position of point to integer coordinate of cell point lies in
function position_to_cell_coord(point) {
  const x_cell_coord = Math.floor(point.x / params.smoothing_radius);
  const y_cell_coord = Math.floor(point.y / params.smoothing_radius);
  const z_cell_coord = Math.floor(point.z / params.smoothing_radius);

  return [x_cell_coord, y_cell_coord, z_cell_coord];
}

// Hash the cell's integer coordinates into a large (likely unique) number
function hash_cell_coord(cell_coord_array) {
  const x_scaled = cell_coord_array[0] * 73856093;
  const y_scaled = cell_coord_array[1] * 19349663;
  const z_scaled = cell_coord_array[2] * 83492791;

  return x_scaled + y_scaled + z_scaled;
}

// use hash value to index the spatial lookup array
function get_LU_key_from_hash(hash_value) {
  return hash_value % num_fluid_points; // spatial_lookup.length() = num_fluid_points
}

function update_spatial_lookup() {
  // identify each particle with its cell in the spatial lookup array
  for (
    let particle_index = 0;
    particle_index < num_fluid_points;
    particle_index++
  ) {
    const hash_value = hash_cell_coord(
      position_to_cell_coord(fluid_points[particle_index].position.clone())
    );
    const cell_key = get_LU_key_from_hash(hash_value);
    spatial_lookup[particle_index] = [particle_index, cell_key];
    start_indices[particle_index] = maxInt; // reset the start index before sorting
  }

  // sort the spatial_lookup array by cell_key
  spatial_lookup = spatial_lookup.sort((a, b) => a[1] - b[1]);

  // determine start index in spatial lookup of each unique cell key
  for (let i = 0; i < num_fluid_points; i++) {
    const curr_key = spatial_lookup[i][1];
    const prev_key = i == 0 ? maxInt : spatial_lookup[i - 1][1];
    if (curr_key != prev_key) {
      start_indices[curr_key] = i;
    }
  }
}

function addArrays(arr1, arr2) {
  const result = [];
  for (let i = 0; i < arr1.length; i++) {
    result.push(arr1[i] + arr2[i]);
  }
  return result;
}

const offsets = [-1, 0, 1];
const num_cells_if_boundary_length_1 = Math.ceil(1 / params.smoothing_radius);
function get_neighbor_indices(sample_point) {
  let neighbor_indices = [];
  const rSq = params.smoothing_radius ** 2;

  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      for (let dk = -1; dk <= 1; dk++) {
        // find cell of sample point
        const sample_cell_coords = addArrays(
          position_to_cell_coord(sample_point),
          [di, dj, dk]
        );
        // // make sure cell coordinates obey periodic boundary conditions, where appropriate -- does not currently work
        // sample_cell_coords[0] = (sample_cell_coords[0] + num_cells_if_boundary_length_1) % num_cells_if_boundary_length_1
        // sample_cell_coords[2] = (sample_cell_coords[2] + num_cells_if_boundary_length_1) % num_cells_if_boundary_length_1 // search criterion for periodic boundary in z
        const cell_key = get_LU_key_from_hash(
          hash_cell_coord(sample_cell_coords)
        );

        const start_ind = start_indices[cell_key];
        for (
          let lookup_ind = start_ind;
          lookup_ind < num_fluid_points;
          lookup_ind++
        ) {
          // ensure only looking at cell with particle and its neighbors
          if (spatial_lookup[lookup_ind][1] != cell_key) {
            break;
          }

          // check particle is within smoothing radius
          const particle_ind = spatial_lookup[lookup_ind][0];
          // const distSq = fluid_points[particle_ind].position.clone().sub(sample_point).lengthSq(); // original
          const predicted_pos = predicted_positions[particle_ind].clone();
          const sample_to_predicted_vec = predicted_pos.sub(sample_point); // based on predicted positions
          const distSq = sample_to_predicted_vec.lengthSq();
          // const distSq_no_periodicity = sample_to_predicted_vec.lengthSq();

          // const z_offset = new THREE.Vector3(0,0,1);

          // const distSq_z_plus = (sample_to_predicted_vec.add(z_offset)).lengthSq();
          // const distSq_z_minus = (sample_to_predicted_vec.sub(z_offset)).lengthSq();

          // const distSq = Math.min(distSq_no_periodicity, distSq_z_plus, distSq_z_minus);

          if (distSq <= rSq) {
            neighbor_indices.push(particle_ind);
          }
          // neighbor_indices.push(spatial_lookup[lookup_ind][0]); // this is a particle index
        }
      }
    }
  }

  return neighbor_indices;
}

// Create a Gaussian texture for smooth blending
function createGaussianTexture(r, g, b, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // const centerColor = "rgb(26, 169, 208)";
  // const edgeColor = "rgba(26, 169, 208, 0)";

  // // Convert RGB values to CSS color strings
  // const r = colorParams.r;
  const centerColor = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
  const edgeColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, 0)`; // Fully transparent edges

  // Create radial gradient
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, centerColor); // Center color
  gradient.addColorStop(1, edgeColor); // Transparent edges

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

function compute_object_interaction_acceleration(i) {
  let return_force = new THREE.Vector3(0, 0, 0);
  const simple_force = new THREE.Vector3(1, 1, 1);

  for (let obj_ind = 0; obj_ind < obstacle_objects_in_scene.length; obj_ind++) {
    const particle_position = fluid_points[i].position.clone();
    let object_position = obstacle_objects_in_scene[obj_ind].position.clone();
    object_position.y = particle_position.y;

    const relative_position = particle_position.sub(object_position);
    const dist = relative_position.length() / params.interaction_length_scale;

    return_force.add(
      relative_position
        .normalize()
        .multiplyScalar(params.object_interaction_strength * kernel2D(dist))
    );
  }

  return return_force;
}

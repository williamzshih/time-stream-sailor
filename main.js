import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x87ceeb);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 20;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshPhongMaterial({ color: 0x2e8b57 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

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

const obstacles = [];
for (let i = 0; i < 10; i++) {
  const obstacle = new THREE.Mesh(
    // change geometries
    new THREE.IcosahedronGeometry(1),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
    })
  );
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  obstacle.position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
  scene.add(obstacle);
  obstacles.push(obstacle);
}

const loader = new OBJLoader();
let player = new THREE.Object3D();
let playerCollisionMesh;
let other;
let otherCollisionMesh;
const tempBoundingBox = new THREE.Box3();
const tempVector = new THREE.Vector3();

loader.load("boat.obj", (boat) => {
  boat.scale.set(0.01, 0.01, 0.01);

  // start off rotated later

  boat.traverse((child) => {
    if (child.isMesh) {
      child.geometry = mergeVertices(child.geometry);
      child.material = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  player = boat;
  scene.add(player);

  tempBoundingBox.setFromObject(player).getSize(tempVector);
  tempVector.multiplyScalar(0.8);
  // make meshes more accurate later
  playerCollisionMesh = new THREE.Mesh(
    new THREE.BoxGeometry(tempVector.x, tempVector.y, tempVector.z)
  );
  playerCollisionMesh.visible = false;
  scene.add(playerCollisionMesh);

  other = boat.clone();
  other.position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
  scene.add(other);

  tempBoundingBox.setFromObject(other).getSize(tempVector);
  tempVector.multiplyScalar(0.8);
  // make meshes more accurate later
  otherCollisionMesh = new THREE.Mesh(
    new THREE.BoxGeometry(tempVector.x, tempVector.y, tempVector.z)
  );
  otherCollisionMesh.visible = false;
  otherCollisionMesh.position.copy(other.position);
  scene.add(otherCollisionMesh);
  obstacles.push(otherCollisionMesh);
});

// start of SAT collision detection

function getProjection(object, axis) {
  const vertices = object.geometry.getAttribute("position");
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < vertices.count; i++) {
    tempVector
      .fromBufferAttribute(vertices, i)
      .applyMatrix4(object.matrixWorld);
    const dot = axis.dot(tempVector);
    min = Math.min(min, dot);
    max = Math.max(max, dot);
  }

  return { min, max };
}

// make more efficient later
function removeDuplicatesAndNormalize(normals) {
  const uniqueNormals = [];
  const EPSILON = 0.000001;

  outer: for (const normal of normals) {
    for (const uniqueNormal of uniqueNormals) {
      const dot = Math.abs(normal.dot(uniqueNormal));
      if (Math.abs(dot - 1) < EPSILON) {
        continue outer;
      }
    }
    uniqueNormals.push(normal.normalize());
  }

  return uniqueNormals;
}

function getNormals(object) {
  const normalsAttribute = object.geometry.getAttribute("normal");
  const normals = [];

  for (let i = 0; i < normalsAttribute.count; i++) {
    tempVector
      .fromBufferAttribute(normalsAttribute, i)
      .applyMatrix4(object.matrixWorld.invert().transpose());
    normals.push(tempVector.clone());
  }

  return normals;
}

function checkCollision(object1, object2) {
  let minOverlap = Infinity;
  let minAxis;

  for (const axis of removeDuplicatesAndNormalize([
    ...getNormals(object1),
    ...getNormals(object2),
  ])) {
    const projection1 = getProjection(object1, axis);
    const projection2 = getProjection(object2, axis);

    if (
      projection1.max <= projection2.min ||
      projection2.max <= projection1.min
    ) {
      return null;
    }

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

// end of SAT collision detection

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  " ": false,
  Shift: false,
};

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() in keys) {
    keys[e.key.toLowerCase()] = true;
  } else if (e.key === " ") {
    keys[" "] = true;
  } else if (e.key === "Shift") {
    keys.Shift = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() in keys) {
    keys[e.key.toLowerCase()] = false;
  } else if (e.key === " ") {
    keys[" "] = false;
  } else if (e.key === "Shift") {
    keys.Shift = false;
  }
});

const moveDirection = new THREE.Vector3();
const camDirection = new THREE.Vector3();
const camRight = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const toObstacle = new THREE.Vector3();
const MTV = new THREE.Vector3();
const MOVE_SPEED = 0.1;
const COLLISION_CHECK_RADIUS = 10;

function animate() {
  requestAnimationFrame(animate);

  moveDirection.set(0, 0, 0);
  camera.getWorldDirection(camDirection);
  camDirection.y = 0;
  camDirection.normalize();
  camRight.crossVectors(camDirection, worldUp);

  if (keys.w) moveDirection.add(camDirection);
  if (keys.s) moveDirection.sub(camDirection);
  if (keys.a) moveDirection.sub(camRight);
  if (keys.d) moveDirection.add(camRight);
  if (keys[" "]) moveDirection.add(worldUp);
  if (keys.Shift) moveDirection.sub(worldUp);

  if (moveDirection.x !== 0 || moveDirection.y !== 0 || moveDirection.z !== 0) {
    moveDirection.normalize();
    player.position.addScaledVector(moveDirection, MOVE_SPEED);
    playerCollisionMesh.position.copy(player.position);
    for (const obstacle of obstacles) {
      toObstacle.subVectors(obstacle.position, playerCollisionMesh.position);
      const distanceSquared = toObstacle.lengthSq();

      if (distanceSquared < COLLISION_CHECK_RADIUS * COLLISION_CHECK_RADIUS) {
        const collision = checkCollision(playerCollisionMesh, obstacle);
        if (collision) {
          if (toObstacle.dot(collision.minAxis) > 0) collision.minAxis.negate();
          MTV.copy(collision.minAxis).multiplyScalar(collision.minOverlap);
          player.position.add(MTV);
          playerCollisionMesh.position.copy(player.position);
        }
      }
    }
  }

  controls.target.copy(player.position);
  controls.update();

  renderer.render(scene, camera);
}

animate();

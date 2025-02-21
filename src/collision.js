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

function getRandomGeometry() {
  const geometries = [
    new THREE.BoxGeometry(
      Math.random() + 1,
      Math.random() + 1,
      Math.random() + 1
    ),
    new THREE.CapsuleGeometry(Math.random() + 1, Math.random() + 1),
    new THREE.CylinderGeometry(
      Math.random() + 1,
      Math.random() + 1,
      Math.random() + 1
    ),
    new THREE.DodecahedronGeometry(Math.random() + 1),
    new THREE.IcosahedronGeometry(Math.random() + 1),
    new THREE.OctahedronGeometry(Math.random() + 1),
    new THREE.TetrahedronGeometry(Math.random() + 1),
  ];

  return geometries[Math.floor(Math.random() * geometries.length)];
}

const obstacles = [];
for (let i = 0; i < 10; i++) {
  const obstacle = new THREE.Mesh(
    getRandomGeometry(),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
    })
  );
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  let randomX = Math.random() * 20 - 10;
  while (Math.abs(randomX) < 2) {
    randomX = Math.random() * 20 - 10;
  }
  let randomZ = Math.random() * 20 - 10;
  while (Math.abs(randomZ) < 2) {
    randomZ = Math.random() * 20 - 10;
  }
  obstacle.position.set(randomX, 0, randomZ);
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
  boat.rotation.x = -Math.PI / 2;
  boat.rotation.z = Math.PI / 2;

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
  tempVector.multiplyScalar(0.9);
  // make meshes more accurate later
  playerCollisionMesh = new THREE.Mesh(
    new THREE.BoxGeometry(tempVector.x, tempVector.y, tempVector.z)
  );
  playerCollisionMesh.visible = false;
  scene.add(playerCollisionMesh);

  other = boat.clone();
  let randomX = Math.random() * 20 - 10;
  while (Math.abs(randomX) < 2) {
    randomX = Math.random() * 20 - 10;
  }
  let randomZ = Math.random() * 20 - 10;
  while (Math.abs(randomZ) < 2) {
    randomZ = Math.random() * 20 - 10;
  }
  other.position.set(randomX, 0, randomZ);
  scene.add(other);

  tempBoundingBox.setFromObject(other).getSize(tempVector);
  tempVector.multiplyScalar(0.9);
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
  shift: false,
};

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() in keys) {
    keys[e.key.toLowerCase()] = true;
  } else if (e.key === " ") {
    keys[" "] = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() in keys) {
    keys[e.key.toLowerCase()] = false;
  } else if (e.key === " ") {
    keys[" "] = false;
  }
});

let velocity = 0;
const ACCELERATION = 0.005;
const ROTATION_SPEED = 0.025;
const FRICTION = 0.99;
const COLLISION_CHECK_RADIUS = 10;
const VERTICAL_SPEED = 0.05;
const direction = new THREE.Vector3(0, 0, -1);
const worldUp = new THREE.Vector3(0, 1, 0);
const toObstacle = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  if (playerCollisionMesh) {
    if (keys.w) velocity += ACCELERATION;
    if (keys.s) velocity -= ACCELERATION;
    if (keys.a) {
      player.rotation.z += ROTATION_SPEED;
      playerCollisionMesh.rotation.y += ROTATION_SPEED;
      direction.applyAxisAngle(worldUp, ROTATION_SPEED);
    }
    if (keys.d) {
      player.rotation.z -= ROTATION_SPEED;
      playerCollisionMesh.rotation.y -= ROTATION_SPEED;
      direction.applyAxisAngle(worldUp, -ROTATION_SPEED);
    }
    if (keys[" "]) {
      player.position.y += VERTICAL_SPEED;
      playerCollisionMesh.position.y += VERTICAL_SPEED;
    }
    if (keys.shift) {
      player.position.y -= VERTICAL_SPEED;
      playerCollisionMesh.position.y -= VERTICAL_SPEED;
    }
    velocity *= FRICTION;

    player.position.add(direction.clone().multiplyScalar(velocity));
    playerCollisionMesh.position.copy(player.position);

    for (const obstacle of obstacles) {
      toObstacle.subVectors(obstacle.position, playerCollisionMesh.position);
      const distanceSquared = toObstacle.lengthSq();

      if (distanceSquared < COLLISION_CHECK_RADIUS * COLLISION_CHECK_RADIUS) {
        const collision = checkCollision(playerCollisionMesh, obstacle);
        if (collision) {
          if (toObstacle.dot(collision.minAxis) > 0) collision.minAxis.negate();
          player.position.add(
            collision.minAxis.multiplyScalar(collision.minOverlap)
          );
          playerCollisionMesh.position.copy(player.position);
        }
      }
    }

    controls.target.copy(player.position);
    controls.update();
  }

  renderer.render(scene, camera);
}

animate();

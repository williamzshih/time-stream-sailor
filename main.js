import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

const pastelBlue = 0xA7C7E7;
const pastelGreen = 0xC1E1C1;
const MOVE_SPEED = 0.1;
const ROTATE_SPEED = 0.1;

const mesh1 = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: pastelBlue })
);
mesh1.position.x = -1;
scene.add(mesh1);

const mesh2 = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: pastelGreen })
);
mesh2.position.x = 1;
scene.add(mesh2);

camera.position.set(0, 2, 5);
camera.lookAt(new THREE.Vector3(0, 0, 0))

function createAxis(color, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: color });
    scene.add(new THREE.Line(geometry, material));
};

createAxis(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0)); // x-axis
createAxis(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0)); // y-axis
createAxis(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5)); // z-axis

// START OF COLLISION DETECTION
function getOverlap(projection1, projection2) {
	return Math.min(
		projection1.max - projection2.min,
		projection2.max - projection1.min
	);
}

function overlaps(projection1, projection2) {
    return !(
        projection1.max <= projection2.min ||
        projection2.max <= projection1.min
    );
}

let vertex = new THREE.Vector3();

function getVertices(mesh) {
	const positions = mesh.geometry.getAttribute('position');
	const vertices = [];
	
	for (let i = 0; i < positions.count; i++) {
		vertex.fromBufferAttribute(positions, i);
		vertex.applyMatrix4(mesh.matrixWorld);
		vertices.push(vertex.clone());
	}
	
	return vertices;
}

function project(mesh, axis) {
	const vertices = getVertices(mesh);
	
	let min = Infinity;
	let max = -Infinity;
	
	for (const vertex of vertices) {
		const dot = axis.dot(vertex);
		min = Math.min(min, dot);
		max = Math.max(max, dot); 
	}
	
	return { min, max };
}

function removeDuplicateNormals(normals) {
    const uniqueNormals = [];
    const EPSILON = 0.000001;
    
    outer:
    for (const normal of normals) {
        for (const uniqueNormal of uniqueNormals) {
            const dot = Math.abs(normal.dot(uniqueNormal));
            if (Math.abs(dot - 1) < EPSILON) {
                continue outer;
            }
        }
        uniqueNormals.push(normal);
    }
    
    return uniqueNormals;
}

const p1 = new THREE.Vector3();
const p2 = new THREE.Vector3();
const p3 = new THREE.Vector3();
const edge1 = new THREE.Vector3();
const edge2 = new THREE.Vector3();
const normal = new THREE.Vector3();

function getNormals(mesh) {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    const normals = [];

    if (geometry.index) {
        const indices = geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) {
            p1.fromBufferAttribute(positions, indices[i]).applyMatrix4(mesh.matrixWorld);
            p2.fromBufferAttribute(positions, indices[i + 1]).applyMatrix4(mesh.matrixWorld);
            p3.fromBufferAttribute(positions, indices[i + 2]).applyMatrix4(mesh.matrixWorld);

            edge1.subVectors(p2, p1);
            edge2.subVectors(p3, p2);
            normal.crossVectors(edge1, edge2).normalize();
            
            normals.push(normal.clone());
        }
    } else {
        for (let i = 0; i < positions.count; i += 3) {
            p1.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            p2.fromBufferAttribute(positions, i + 1).applyMatrix4(mesh.matrixWorld);
            p3.fromBufferAttribute(positions, i + 2).applyMatrix4(mesh.matrixWorld);

            edge1.subVectors(p2, p1);
            edge2.subVectors(p3, p2);
            normal.crossVectors(edge1, edge2).normalize();
            
            normals.push(normal.clone());
        }
    }
    
    return normals;
}

function checkCollision(mesh1, mesh2) {
	const axes = removeDuplicateNormals([...getNormals(mesh1), ...getNormals(mesh2)]);

    let minOverlap = Infinity;
    let minAxis;

    for (const axis of axes) {
        const projection1 = project(mesh1, axis);
        const projection2 = project(mesh2, axis);

        if (!overlaps(projection1, projection2)) {
            return null;
        }

        const overlap = getOverlap(projection1, projection2);

        if (overlap < minOverlap) {
            minOverlap = overlap;
            minAxis = axis;
        }
    }

    return { minAxis, minOverlap };
}

const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false,
    Shift: false,
	ArrowUp: false,
    ArrowLeft: false,
	ArrowDown: false,
    ArrowRight: false,
};

window.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
    }
    if (e.key === 'Shift') {
        keys.Shift = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
    if (e.key === 'Shift') {
        keys.Shift = false;
    }
});

let pushVector = new THREE.Vector3();
let toObject = new THREE.Vector3();

function animate() {
	requestAnimationFrame(animate);

    if (keys.w) mesh1.position.z -= MOVE_SPEED;
	if (keys.a) mesh1.position.x -= MOVE_SPEED;
    if (keys.s) mesh1.position.z += MOVE_SPEED;
    if (keys.d) mesh1.position.x += MOVE_SPEED;
    if (keys[' ']) mesh1.position.y += MOVE_SPEED;
    if (keys.Shift) mesh1.position.y -= MOVE_SPEED;

	if (keys.ArrowUp) mesh1.rotation.x -= ROTATE_SPEED;
    if (keys.ArrowLeft) mesh1.rotation.z += ROTATE_SPEED;
	if (keys.ArrowDown) mesh1.rotation.x += ROTATE_SPEED;
    if (keys.ArrowRight) mesh1.rotation.z -= ROTATE_SPEED;

	const collision = checkCollision(mesh1, mesh2);

	if (collision) {
		const axis = collision.minAxis;
        const overlap = collision.minOverlap;

		toObject.subVectors(mesh2.position, mesh1.position);
		
		if (axis.dot(toObject) > 0) {
			axis.negate();
		}
		
		// mesh2.position.sub(pushVector.copy(axis).multiplyScalar(overlap)); // mesh 1 can push mesh 2
        mesh1.position.add(pushVector.copy(axis).multiplyScalar(0.25 * overlap)); // mesh 2 blocks mesh 1
	}

    renderer.render(scene, camera);
}

animate();
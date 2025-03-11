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
import * as THREE from 'three';
import * as dat from 'dat.gui'; // GUI
import Stats from 'stats.js'; // FPS counter
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { compute, step } from 'three/tsl';


const scene = new THREE.Scene();

//THREE.PerspectiveCamera( fov angle, aspect ratio, near depth, far depth );
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// ADD FPS COUNTER
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const controls = new OrbitControls(camera, renderer.domElement);
// camera.position.set(1.5, 1.5, 1.5);
// controls.target.set(0, 0, 0);
// 2D testing
camera.position.set(0.5, 0.5, 3.);
controls.target.set(0.5, 0, 1.5);

// Rendering 3D axis
const createAxisLine = (color, start, end) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: color });
    return new THREE.Line(geometry, material);
};
const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 0)); // Red
const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0)); // Green
const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 3)); // Blue
scene.add(xAxis);
scene.add(yAxis);
scene.add(zAxis);


// Setting up the lights
const pointLight = new THREE.PointLight(0xffffff, 100, 100);
pointLight.position.set(5, 5, 5); // Position the light
scene.add(pointLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0.5, .0, 1.0).normalize();
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x505050);  // Soft white light
scene.add(ambientLight);
// **************************************************************************************************





// **************************************************************************************************
// *********************************** OBSTACLE OBJECTS IN SCENE ************************************
// **************************************************************************************************

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
for (let i = 0; i < 20; i++) {
    let randomX = Math.random() * 0.8;  // x between 0 and 0.8
    let randomZ = Math.random() * (-40) - 1;  // z between -5 and -1
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
    point_opacity: 0.5, // 0.6 nice visually
    show_neighbor_search: false,

    // BOUNDARY VISUALIZATION
    boundary_point_size: 0.01,
    boundary_point_opacity: 1,
    boundary_box_width: 1., // previously 0.8
    boundary_box_length: 3., // previously 1.4

    // FLUID PROPERTIES    
    stiffness: 1.,         // previously 0.5
    viscosity: 100,             // unstable for > 500 --- mu in equations, viscosity of the fluid that resists velocity change
    smoothing_radius: 0.15,      // <= 0.1 nicer looking
    grav_strength: 1.5,         // previously 1.5
    rest_density_factor: 1,    // unstable for < 2

    // OBJECTS THAT INTERACT WITH FLUID
    object_interaction_strength: 0.35, // previously 0.2
    interaction_length_scale: 1,
};

// NUMBER OF POINTS
// in 3d max ~1500 with current smoothing radius of 0.1
const water_color = "rgb(26, 169, 208)"; // vibrant water color: "rgb(26, 169, 208)"
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
const max_time_step = 1/10; // maximum time step for physics
const max_velocity = 3; // maximum velocity of fluid points for numerical stability
const BUFFER = 0.001; // Small buffer to prevent sticking to boundaries
const DAMPING = 0.8;  // Velocity damping factor

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
let boundary_geometry = new THREE.BoxGeometry( params.boundary_box_width, 1, params.boundary_box_length );
let boundary_wireframe = new THREE.WireframeGeometry( boundary_geometry );
const line = new THREE.LineSegments( boundary_wireframe );
line.material.depthTest = false;
line.material.opacity = 0.5;
line.material.transparent = true;
line.position.set(params.boundary_box_width / 2, 0.5, params.boundary_box_length / 2);
scene.add( line );

// // ADD BASE COLOR OF WATER BELOW BOUNDING BOX
// let base_water_box_geometry = new THREE.BoxGeometry( params.boundary_box_width, 0.01, 3 * params.boundary_box_length );
// const base_water_material = new THREE.MeshBasicMaterial({
//     color: "rgb(117,255,255)",
//     transparent: false,
//     // opacity: params.opacity,  // Semi-transparent for a water-like effect
// });

// const waterBaseMaterial = new THREE.MeshBasicMaterial({
//     color: "rgb(117,255,255)",  // Same color as fluid particles
//     transparent: true,
//     opacity: 1.,  // Semi-transparent for a glowing effect
//     blending: THREE.AdditiveBlending,  // Make it glow like particles
//     depthWrite: false, // Prevents depth issues with transparency
// });

// // Create the water base mesh
// const base_water_box = new THREE.Mesh(base_water_box_geometry, waterBaseMaterial);

// // Position it at the bottom of the bounding box
// base_water_box.position.set( params.boundary_box_width / 2, -0.01 / 2, - params.boundary_box_length / 2); // Adjust `y` position to align with floor

// Add to scene
// scene.add(base_water_box);

// *********************************************************************************






// *********************************************************************************
// GEOMETRY AND MATERIAL
// const fluid_point_geometry = new THREE.SphereGeometry(params.point_radius);
const boundary_point_geometry = new THREE.BoxGeometry( params.boundary_point_size, params.boundary_point_size, params.boundary_point_size );
// const fluid_material = new THREE.MeshBasicMaterial({ color: 0x1AA9D0, opacity: params.point_opacity, transparent: true,});
const boundary_material = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: params.boundary_point_opacity, transparent: true,});

// INSTANTIATE THE POINTS
// let fluid_points = Array.from({length: num_fluid_points}, () => new THREE.Mesh(fluid_point_geometry, fluid_material));
let boundary_points = Array.from({length: num_boundary_particles}, () => new THREE.Mesh(boundary_point_geometry, boundary_material));

// // INITIALIZE FLUID AND ADD TO SCENE
// for(let i=0; i<num_fluid_points; i++) {
//     fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, Math.random()*0.5 + 0.1); // Set position to random in box (0,0,0) - (1,1,1)
// 	scene.add(fluid_points[i]);
// }



// Create a shared material for all particles
const gaussianTexture = createGaussianTexture();
const fluid_material = new THREE.SpriteMaterial({
    map: gaussianTexture,
    color: water_color,//0x1AA9D0,
    opacity: params.point_opacity,
    transparent: true,
    depthWrite: false,  // Avoid depth conflicts
    blending: THREE.AdditiveBlending,  // Smooth blending between particles
});


// Create sprite-based fluid points
let fluid_points = Array.from({ length: num_fluid_points }, () => new THREE.Sprite(fluid_material));

// INITIALIZE FLUID AND ADD TO SCENE
for (let i = 0; i < num_fluid_points; i++) {
    fluid_points[i].scale.set(params.point_radius * 2, params.point_radius * 2, 1);  // Scale sprite to match sphere size
    fluid_points[i].position.set(
        Math.random() * 0.3 + 0.5,
        Math.random() * 0.4 + 0.2,
        Math.random() * 1. + 1.5
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
    sprite.scale.set(params.point_radius * 2, params.point_radius * 2, 1);  // Scale sprite to match sphere size
    
    // Randomly distribute points within the given range
    // below box
    const x = Math.random() * 1;  
    let y = Math.random() * 0.2 - 0.2; 
    let z = Math.random() * 3; 

    // behind box
    if (i > num_below_box) { 
        y = Math.random() * 0.2;  // -0.3 to 0
        z = Math.random() * 6 - 6;  // 0 to 3
    }

    sprite.position.set(x, y, z);
    
    scene.add(sprite);
    stationary_points.push(sprite);
}


// Create mirrored fluid points array
let mirror_points = fluid_points.map(original => {
    const mirrored = new THREE.Sprite(fluid_material);
    mirrored.scale.set(params.point_radius * 2, params.point_radius * 2, 1);  // Scale sprite to match sphere size
    mirrored.position.set(original.position.x, original.position.y, -original.position.z); // Mirror across z-axis
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
set_up_boundary_points(num_points_per_side, true)
// ************************************************************************************








// ************************************************************************************
// ****************************** GUI FOR TESTING VALUES ******************************
// ************************************************************************************
const gui = new dat.GUI();

// POINT VISUALIZATION
const VisualsFolder = gui.addFolder('Fluid Visuals');
VisualsFolder.add(params, "point_radius", 0.005, 0.2).name('Point Radius').onChange((newRadius) => {
//     fluid_points.forEach((sphere) => {
//         sphere.geometry.dispose(); // Dispose old geometry
//         sphere.geometry = new THREE.SphereGeometry(newRadius); // Create new geometry
//     });
// });
    fluid_points.forEach((point) => {
        point.scale.set(newRadius * 2, newRadius * 2, 1);  // Scale sprite to match sphere size

        // point.geometry.dispose(); // Dispose old geometry
        // fluid_material.
        // point.geometry = new THREE.SphereGeometry(newRadius); // Create new geometry
    });
});
VisualsFolder.add(fluid_material, "opacity", 0, 1).name('Point Opacity');
VisualsFolder.add(params, 'show_neighbor_search').name('Show Neighbor Search?');
VisualsFolder.open();


// BOUNDARY VISUALIZATION
const BoundaryFolder = gui.addFolder('Boundaries');
BoundaryFolder.add(params, "boundary_box_width", 0.1, 1).name('Box Width').onChange((newSize) => { // initialize at max in GUI as I don't want to update hashing declaration yet
    line.geometry.dispose();
    boundary_geometry = new THREE.BoxGeometry(newSize, 1, params.boundary_box_length);
    boundary_wireframe = new THREE.WireframeGeometry(boundary_geometry);
    line.geometry = boundary_wireframe;
    line.position.set(newSize / 2, 0.5, params.boundary_box_length / 2);
    // set_up_boundary_points(num_points_per_side);
});
BoundaryFolder.add(params, "boundary_box_length", 0.1, 3).name('Box Length').onChange((newSize) => { // initialize at max in GUI as I don't want to update hashing declaration yet
    line.geometry.dispose();
    boundary_geometry = new THREE.BoxGeometry(params.boundary_box_width, 1, newSize);
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
const FluidFolder = gui.addFolder('Fluid Properties');
FluidFolder.add(params, 'stiffness', 0.05, 5).name('stiffness');
FluidFolder.add(params, 'viscosity', 0, 700).name('viscosity');
FluidFolder.add(params, 'smoothing_radius', 0.02, 0.5).name('smoothing_radius');
FluidFolder.add(params, 'grav_strength', 0, 10).name('grav_strength');
FluidFolder.add(params, 'rest_density_factor', 0.6, 5).name('Rest Density');
FluidFolder.open();

// OBJECT INTERACTION PROPERTIES
const ObjectInteractionFolder = gui.addFolder('Object Interactions');
ObjectInteractionFolder.add(params, 'object_interaction_strength', 0.01, 1).name('strength');
ObjectInteractionFolder.add(params, 'interaction_length_scale', 0.5, 2).name('distance');
ObjectInteractionFolder.open();
// *********************************************************************************







// **************************************************************************************************
// *********************************** GLOBAL VARIABLES TO UPDATE ***********************************
// **************************************************************************************************
// TIME
let animation_time = 0;
let dt;
const clock = new THREE.Clock();
let last_time_spatial_lookup_updated = -1;
const update_delay = 0.1; // how long to wait before updating the spatial lookup array

// ARRAYS
let density = Array.from({length: num_points}, (v,i) => i < num_fluid_points ? 0 : rest_density()); // density of each point
let pressure_acceleration = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0)); // negative gradient of pressure / density, with simple eqn of state p = k * (rho - rho_0)
let velocity = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0));
let mass_array = Array.from({length: num_points}, (v, i) => i < num_fluid_points ? mass : mass_boundary);
let predicted_positions = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0));

let spatial_lookup = Array.from({length: num_fluid_points}, () => [0,0]); // entries are [particle_index, cell_key]
const maxInt = Number.MAX_SAFE_INTEGER;
let start_indices = Array.from({length: num_fluid_points}, () => maxInt); // entry i (particle index) indicates where corresponding cell begins indexing in spatial_lookup
// **************************************************************************************************




// *********************************************************************************************
// **************************************** RENDER LOOP ****************************************
// *********************************************************************************************
function animate() {
    stats.begin(); // FPS counter
    renderer.render( scene, camera );
    stats.end(); // FPS counter
    controls.update();

    // update time and delta_t
    // dt = clock.getDelta(); // get time since last frame
    dt = Math.min(clock.getDelta(), max_time_step); // make sure physics time step is sufficiently small
    animation_time += dt; 


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
        predicted_positions[i] = fluid_points[i].position.clone().add( velocity[i].clone().multiplyScalar(dt) );
    }

    // const current_positions = fluid_points.map(p => p.position.clone());
    compute_density(predicted_positions);

    // compute total force on each FLUID particle (boundary particles stationary)
    for(let i=0; i<num_fluid_points; i++) {
        // FIRST UPDATE VELOCITY WITH VISCOSITY AND GRAVITY
        const a_grav = compute_gravity_force(fluid_points[i].position.clone()); // GRAVITATIONAL FORCE
        const a_viscosity = compute_viscosity_force(i); // viscosity FORCE
        // const a_boundary = compute_boundary_force(fluid_points[i].position.clone()); // BOUNDARY FORCE - try to enforce stronger boundary conditions
        // determine forces due to interaction with objects
        const a_object_interaction = compute_object_interaction_acceleration(i);

        const dv0 = a_grav.clone().add(a_viscosity.add(a_object_interaction)).multiplyScalar(dt); // .add(a_boundary)
        velocity[i].add( dv0 );
        velocity[i] = clamp_velocity(velocity[i]);
        // predicted_positions[i] = fluid_points[i].position.clone().add( velocity[i].clone().multiplyScalar(dt) );

        compute_pressure_acceleration(i, predicted_positions);

        // ------- update velocity ----------
        // fluid_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) ); // go back to before prediction
        // all_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) );
        velocity[i].add( pressure_acceleration[i].clone().multiplyScalar(dt) ); // add
        velocity[i] = clamp_velocity(velocity[i]);

        // update position  
        const dx = velocity[i].clone().multiplyScalar(dt);
        fluid_points[i].position.add( dx );
        // all_points[i].position.add( dx );

        // check for NaNs and handle boundary collisions
        velocity[i] = clamp_velocity(velocity[i]);
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
}
renderer.setAnimationLoop( animate );
// **************************************************************************************************



// ************************************ KEYBOARD INTERACTION ****************************************
const moveSpeed = 0.03;
const keys = {}; // Object to track pressed keys

// Listen for key presses
document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});

// Listen for key releases
document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

// Function to smoothly update obstacle positions
function updateObstacles() {
    let moveX = 0;
    let moveZ = 0;

    if (keys["w"]) moveZ -= moveSpeed; // Move forward
    if (keys["s"]) moveZ += moveSpeed; // Move backward
    if (keys["a"]) moveX -= moveSpeed; // Move left
    if (keys["d"]) moveX += moveSpeed; // Move right

    // Apply movement to all obstacle objects
    if (moveX !== 0 || moveZ !== 0) {
        for (let i = 0; i < obstacle_objects_in_scene.length; i++) {
            obstacle_objects_in_scene[i].position.x += moveX;
            obstacle_objects_in_scene[i].position.z += moveZ;
        }
    }

    requestAnimationFrame(updateObstacles); // Keep updating smoothly
}

// Start the movement update loop
updateObstacles();


// **************************************************************************************************





// **************************************************************************************************
// **************************************** HELPER FUNCTIONS ****************************************
// **************************************************************************************************

const volume = Math.PI * Math.pow(params.smoothing_radius, 4) / 6; // 2D kernel volume
function kernel2D(dist) {
    if (dist >= params.smoothing_radius) { return 0; }
    return (params.smoothing_radius - dist) * (params.smoothing_radius - dist) / volume;
}

const scale = 12 / (Math.pow(params.smoothing_radius, 4) * Math.PI);
function kernel2D_deriv(dist) {
    if (dist >= params.smoothing_radius) { return 0; }
    return (dist - params.smoothing_radius) * scale;
}

function rest_density() {
    return params.rest_density_factor * mass / volume_per_particle;
}


// const test_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: params.point_opacity, transparent: true,});
// const neighbor_material = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: params.point_opacity, transparent: true,});

const test_material = new THREE.SpriteMaterial({
    map: gaussianTexture,
    color: 0xff0000,  // Keep your fluid color
    opacity: 1,
    transparent: true,
    depthWrite: false,  // Avoid depth conflicts
    blending: THREE.AdditiveBlending,  // Smooth blending between particles
});

const neighbor_material = new THREE.SpriteMaterial({
    map: gaussianTexture,
    color: 0xffff00,  // Keep your fluid color
    opacity: 1,
    transparent: true,
    depthWrite: false,  // Avoid depth conflicts
    blending: THREE.AdditiveBlending,  // Smooth blending between particles
});

function show_neighbor_searching() {
    // first make all same color, then modify
    for (let i=0; i<num_fluid_points; i++){ fluid_points[i].material = fluid_material; }

    if (params.show_neighbor_search == true) {
        const test_ind = 0;

        // make test point red
        fluid_points[test_ind].material = test_material;

        // make neighbor points yellow
        const test_point = fluid_points[test_ind].position.clone();
        for (const neighbor_idx of get_neighbor_indices(test_point)){
            if (neighbor_idx == test_ind) {continue;}
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
    const y_force = norm_pos.y > 0 ? - params.grav_strength * ( 1 - Math.exp(-grav_drop_off_strength * (norm_pos.y-0.03)) ) : 0;
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

function compute_viscosity_force(particle_index){
    let viscosity_force = new THREE.Vector3(0,0,0);
    const current_position = fluid_points[particle_index].position.clone();

    // fluid contribution
    for (const j of get_neighbor_indices(current_position)){
        if (j == particle_index) {continue;}

        const j_to_i = fluid_points[j].position.clone().sub(current_position);
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );
        const velocity_diff = velocity[particle_index].clone().sub(velocity[j].clone());
        // params.viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
        
        // original lapalacian formulation
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)) * params.viscosity / density[particle_index]));
    
        // // simplified (linear) velocity smoothing - does not work much better
        // const kernel = kernel2D( dist );
        // viscosity_force.add( velocity_diff.multiplyScalar(- params.viscosity * mass_array[j] / density[j] * kernel / 100) );
    }

    // boundary contribution
    for(let j=0; j<num_boundary_particles; j++) {
        const j_to_i = boundary_points[j].position.clone().sub(current_position);
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );
        const velocity_diff = velocity[particle_index].clone(); // boundary point stationary
        // viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)) * params.viscosity / density[particle_index]));
    }
    return viscosity_force;
}


// ********** COMPUTE DENSITY -- density computed for FLUID points only (boundary set to rest density) **********
function compute_density(fluid_positions_arg) {
    const density_at_rest = rest_density()
    // compute FLUID density rho_i at point x_i due to all points
    for(let i=0; i<num_fluid_points; i++) {
        density[i] = density_at_rest; // ** VERY IMPORTANT ** -- reset density to REST density of fluid before computing

        // density correction factor for this specific fluid particle to account for one layer of boundary particles
        // const boundary_correction_factor = density_correction_factor(i); // seems to be causing instability
        const boundary_correction_factor = mass_boundary / mass;

        // fluid contribution
        for (const j of get_neighbor_indices(fluid_positions_arg[i])){
            if (j == i) {continue;}

            const dist = fluid_positions_arg[i].distanceTo(fluid_positions_arg[j]);
            const kernel_value = kernel2D(dist);
            density[i] += mass * kernel_value;
        }

        // boundary contribution
        for(let j=0; j<num_boundary_particles; j++) {
            const dist = fluid_positions_arg[i].distanceTo(boundary_points[j].position.clone());
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
    pressure_acceleration[i].set(0,0,0);
    // const current_position = fluid_points[i].position.clone();
    const current_position = positions_array[i].clone();

    // fluid contribution
    for (const j of get_neighbor_indices(current_position)){ // ** may need to change get_neighbor_indices to calculate based on predicted positions
        if (j == i) {continue;}

        // const j_to_i = current_position.clone().sub(fluid_points[j].position.clone());
        const j_to_i = current_position.clone().sub(positions_array[j].clone());
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );

        const pressure_acc = j_to_i.multiplyScalar(- params.stiffness * kernel_deriv / Math.max(dist, min_separation) * mass_array[j] * (1/density[i] + 1/density[j]));

        // pressure_acceleration[i].add( - params.stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
        pressure_acceleration[i].add( pressure_acc );
        // pressure_acceleration[i].set(0,0.01,0);
    }
    
    // boundary contribution
    for(let j=0; j<num_boundary_particles; j++) {
        const j_to_i = current_position.clone().sub(boundary_points[j].position.clone());
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );

        const pressure_acc = j_to_i.multiplyScalar(- params.stiffness * kernel_deriv / Math.max(dist, min_separation) * mass_boundary * (2/density[i])); // approximate boundary with same density as fluid near boundary

        // pressure_acceleration[i].add( - params.stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
        pressure_acceleration[i].add( pressure_acc );
        // pressure_acceleration[i].set(0,0.01,0);
    }
}

// clamp max velocity to help with numerical stability?
function clamp_velocity(velocity) {
    if (velocity.length() > max_velocity) {
        velocity.normalize().multiplyScalar(max_velocity);
    }
    return velocity;
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
        velocity[i].x = Math.abs(velocity[i].x) * DAMPING;
    }
    // x = boundary_box_width
    if (fluid_points[i].position.x > params.boundary_box_width - BUFFER) {
        fluid_points[i].position.x = params.boundary_box_width - BUFFER;
        // all_points[i].position.x = 1 - BUFFER;
        velocity[i].x = -Math.abs(velocity[i].x) * DAMPING;
    }
    // y = 0
    if(fluid_points[i].position.y < 0 + BUFFER) {
        fluid_points[i].position.y = 0 + BUFFER;
        // all_points[i].position.y = 0 + BUFFER;
        velocity[i].y = Math.abs(velocity[i].y) * DAMPING;
    }
    // y = 1
    if (fluid_points[i].position.y > 1 - BUFFER) {
        fluid_points[i].position.y = 1 - BUFFER;
        // all_points[i].position.y = 1 - BUFFER;
        velocity[i].y = -Math.abs(velocity[i].y) * DAMPING;
    }
    // z = 0
    if(fluid_points[i].position.z < 0 + BUFFER) {
        fluid_points[i].position.z = 0 + BUFFER;
        velocity[i].z = Math.abs(velocity[i].z) * DAMPING;
    }
    // z = params.boundary_box_length
    if (fluid_points[i].position.z > params.boundary_box_length - BUFFER) {
        fluid_points[i].position.z = params.boundary_box_length - BUFFER;
        velocity[i].z = -Math.abs(velocity[i].z) * DAMPING;
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

function set_up_boundary_points(num_points_per_side, add_to_scene = false){
    const width = params.boundary_box_width + 2 * boundary_buffer;
    const z_height = 1 + 2 * boundary_buffer;
    for (let i = 0; i < num_boundary_particles; i++) {
        // y = 0 boundary
        if (i >= 0 && i < num_points_per_side) {
            boundary_points[i].position.set((i % num_points_per_side / num_points_per_side) * width - boundary_buffer, -boundary_buffer, 0);
        } 
        // x = params.boundary_box_width boundary 
        else if (i >= num_points_per_side && i < 2 * num_points_per_side) {
            boundary_points[i].position.set(params.boundary_box_width + boundary_buffer, (i % num_points_per_side / num_points_per_side) * z_height - boundary_buffer, 0);
        } 
        // x = 0 boundary
        else if (i >= 2 * num_points_per_side && i < 3 * num_points_per_side) { 
            boundary_points[i].position.set(-boundary_buffer, (i % num_points_per_side / num_points_per_side) * z_height - boundary_buffer, 0);
        }
        if (add_to_scene == true) {
            scene.add(boundary_points[i]);
        }
    }
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
function hash_cell_coord(cell_coord_array){
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
    for (let particle_index=0; particle_index < num_fluid_points; particle_index++) {
        const hash_value = hash_cell_coord( position_to_cell_coord( fluid_points[particle_index].position.clone() ) );
        const cell_key = get_LU_key_from_hash(hash_value);
        spatial_lookup[particle_index] = [particle_index, cell_key];
        start_indices[particle_index] = maxInt; // reset the start index before sorting
    }

    // sort the spatial_lookup array by cell_key
    spatial_lookup = spatial_lookup.sort((a,b) => a[1] - b[1]);

    // determine start index in spatial lookup of each unique cell key
    for (let i=0; i < num_fluid_points; i++) {
        const curr_key = spatial_lookup[i][1];
        const prev_key = i == 0 ? maxInt : spatial_lookup[i-1][1];
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
                const sample_cell_coords = addArrays(position_to_cell_coord(sample_point), [di, dj, dk]);
                // // make sure cell coordinates obey periodic boundary conditions, where appropriate -- does not currently work
                // sample_cell_coords[0] = (sample_cell_coords[0] + num_cells_if_boundary_length_1) % num_cells_if_boundary_length_1
                // sample_cell_coords[2] = (sample_cell_coords[2] + num_cells_if_boundary_length_1) % num_cells_if_boundary_length_1 // search criterion for periodic boundary in z
                const cell_key = get_LU_key_from_hash( hash_cell_coord(sample_cell_coords));

                const start_ind = start_indices[cell_key];
                for(let lookup_ind = start_ind; lookup_ind < num_fluid_points; lookup_ind++){
                    // ensure only looking at cell with particle and its neighbors
                    if (spatial_lookup[lookup_ind][1] != cell_key) { break; }

                    // check particle is within smoothing radius
                    const particle_ind = spatial_lookup[lookup_ind][0];
                    // const distSq = fluid_points[particle_ind].position.clone().sub(sample_point).lengthSq(); // original
                    const predicted_pos = predicted_positions[particle_ind].clone()
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
function createGaussianTexture(size = 128) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Create a radial gradient
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // gradient.addColorStop(0, "rgb(255, 255, 255)");
    // gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    // gradient.addColorStop(0, "rgba(112, 255, 255, 0.5)");  // Light blue center (matches water color)
    // gradient.addColorStop(1, "rgba(112, 255, 255, 0)");  // Fades to transparent
    gradient.addColorStop(0, "rgb(26, 169, 208)");  // Light blue center (matches water color)
    gradient.addColorStop(1, "rgba(26, 169, 208, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
}


function compute_object_interaction_acceleration(i) {
    let return_force = new THREE.Vector3(0,0,0);
    const simple_force = new THREE.Vector3(1,1,1);

    for (let obj_ind = 0; obj_ind < obstacle_objects_in_scene.length; obj_ind++) {
        const particle_position = fluid_points[i].position.clone();
        let object_position = obstacle_objects_in_scene[obj_ind].position.clone();
        object_position.y = particle_position.y;

        const relative_position = particle_position.sub(object_position)
        const dist = relative_position.length() / params.interaction_length_scale;

        return_force.add( relative_position.normalize().multiplyScalar(params.object_interaction_strength * kernel2D(dist)) );
    }

    return return_force;
}
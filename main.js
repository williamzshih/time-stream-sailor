// **********************************************************************************************
// *************************************** TERMINAL SETUP ***************************************
// **********************************************************************************************
//          npm install --save three    
//          npm install --save-dev vite  

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
camera.position.set(0.5, 0.5, 0.9);
controls.target.set(0.5, 0.5, 0);

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

const phong_material = new THREE.MeshPhongMaterial({
    color: 0x00ff00, // Green color
    shininess: 100   // Shininess of the material
});
// **************************************************************************************************



// **************************************************************************************************
// *********************************** SET UP FLUID AND BOUNDARY ************************************
// **************************************************************************************************
// PARAMETERS CONTROLLABLE IN GUI
var params = {
    // FLUID VISULIZATION
    point_radius: 0.01, // 0.05 nice visually
    point_opacity: 0.7,

    // BOUNDARY VISUALIZATION
    boundary_point_size: 0.01,
    boundary_point_opacity: 1,
    boundary_box_width: 1,

    // FLUID PROPERTIES    
    stiffness: 0.5,
    viscosity: 400,             // unstable for > 500 --- mu in equations, viscosity of the fluid that resists velocity change
    smoothing_radius: 0.1,      // <= 0.1 nicer looking
    grav_strength: 3,
    rest_density_factor: 10,    // unstable for < 2
};

// NUMBER OF POINTS
const num_fluid_points = 400; // number of points in the fluid // ***** NOTE >30 FPS when <510 fluid points with no algorithmic acceleration
const num_boundary_particles = 150; // number of points on the boundary
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
const max_time_step = 1/60; // maximum time step for physics
const max_velocity = 3; // maximum velocity of fluid points for numerical stability
const BUFFER = 0.001; // Small buffer to prevent sticking to boundaries
const DAMPING = 0.8;  // Velocity damping factor

// POINT VISUALIZATION
const fluid_point_geometry = new THREE.SphereGeometry(params.point_radius);
const boundary_point_geometry = new THREE.BoxGeometry( params.boundary_point_size, params.boundary_point_size, params.boundary_point_size );
const fluid_material = new THREE.MeshBasicMaterial({ color: 0x1AA9D0, opacity: params.point_opacity, transparent: true,});
const boundary_material = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: params.boundary_point_opacity, transparent: true,});

const test_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: params.point_opacity, transparent: true,});
const neighbor_material = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: params.point_opacity, transparent: true,});

// OTHER CONSTANTS
const total_volume = 1 * 1; // volume of the box
const volume_per_particle = total_volume / num_fluid_points; // volume per particle
// const rest_density = params.rest_density_factor * mass / volume_per_particle; // set rest density of the fluid so that it fills specified size in box
// const boundary_density = 0.001; // effective density of boundary used for calculating boundary forces

// SET UP BOUNDARY
let boundary_geometry = new THREE.BoxGeometry( params.boundary_box_width, 1, 1 );
let boundary_wireframe = new THREE.WireframeGeometry( boundary_geometry );
const line = new THREE.LineSegments( boundary_wireframe );
line.material.depthTest = false;
line.material.opacity = 0.5;
line.material.transparent = true;
line.position.set(params.boundary_box_width / 2,0.5,0.5);
scene.add( line );
// **************************************************************************************************




// ************************************************************************************
// ****************************** GUI FOR TESTING VALUES ******************************
// ************************************************************************************
const gui = new dat.GUI();

// POINT VISUALIZATION
const VisualsFolder = gui.addFolder('Fluid Visuals');
VisualsFolder.add(params, "point_radius", 0.005, 0.1).name('Point Radius').onChange((newRadius) => {
    fluid_points.forEach((sphere) => {
        sphere.geometry.dispose(); // Dispose old geometry
        sphere.geometry = new THREE.SphereGeometry(newRadius); // Create new geometry
    });
});
VisualsFolder.add(fluid_material, "opacity", 0, 1).name('Point Opacity');
VisualsFolder.open();


// BOUNDARY VISUALIZATION
const BoundaryFolder = gui.addFolder('Boundaries');
BoundaryFolder.add(params, "boundary_box_width", 0.1, 1).name('Box Width').onChange((newSize) => { // initialize at max in GUI as I don't want to update hashing declaration yet
    line.geometry.dispose();
    boundary_geometry = new THREE.BoxGeometry(newSize, 1, 1);
    boundary_wireframe = new THREE.WireframeGeometry(boundary_geometry);
    line.geometry = boundary_wireframe;
    line.position.set(newSize / 2, 0.5, 0.5);
    set_up_boundary_points(num_points_per_side);
});
BoundaryFolder.add(params, "boundary_point_size", 0.001, 0.05).name('Point Size').onChange((newSize) => {
    boundary_points.forEach((boundary_box) => {
        boundary_box.geometry.dispose(); // Dispose old geometry
        boundary_box.geometry = new THREE.BoxGeometry(newSize, newSize, newSize); // Create new geometry
    });
});
BoundaryFolder.add(boundary_material, "opacity", 0, 1).name('Point Opacity');
BoundaryFolder.open();


// FLUID PROPERTIES
const FluidFolder = gui.addFolder('Fluid Properties');
FluidFolder.add(params, 'stiffness', 0.05, 1).name('stiffness');
FluidFolder.add(params, 'viscosity', 0, 500).name('viscosity');
FluidFolder.add(params, 'smoothing_radius', 0.02, 0.5).name('smoothing_radius');
FluidFolder.add(params, 'grav_strength', 0, 10).name('grav_strength');
FluidFolder.add(params, 'rest_density_factor', 2.5, 25).name('Rest Density');
FluidFolder.open();
// *********************************************************************************




// *********************************************************************************
// INSTANTIATE THE POINTS
let fluid_points = Array.from({length: num_fluid_points}, () => new THREE.Mesh(fluid_point_geometry, fluid_material));
let boundary_points = Array.from({length: num_boundary_particles}, () => new THREE.Mesh(boundary_point_geometry, boundary_material));

// INITIALIZE FLUID AND ADD TO SCENE
for(let i=0; i<num_fluid_points; i++) {
    fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, 0); // Set position to random in box (0,0,0) - (1,1,1)
	scene.add(fluid_points[i]);
}

// INITIALIZE BOUNDARY POINTS AND ADD TO SCENE
const num_points_per_side = num_boundary_particles / 3;
set_up_boundary_points(num_points_per_side, true)


// **************************************************************************************************
// *********************************** GLOBAL VARIABLES TO UPDATE ***********************************
// **************************************************************************************************
// TIME
let animation_time = 0;
let dt;
const clock = new THREE.Clock();

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


    // ----------------------------------------------- just see if this runs
    // Update the spatial_lookup array
    update_spatial_lookup();
    const test_ind = 0;
    // try to change color of the test particle
    // first make all same color, then modify
    for (let i=0; i<num_fluid_points; i++){
        fluid_points[i].material = fluid_material;
    }
    
    const test_point = fluid_points[test_ind].position.clone();
    // get_neighbor_indices(test_point);
    const neighbor_inds = get_neighbor_indices(test_point);
    for (let i=0; i<neighbor_inds.length; i++){
        const neighbor_idx = neighbor_inds[i];
        fluid_points[neighbor_idx].material = neighbor_material;
    }

    // make test point red
    fluid_points[test_ind].material = test_material;
    // ----------------------------------------------- 

    const current_positions = fluid_points.map(p => p.position.clone());
    // i've seen computing density with predicted positions can be unstable
    compute_density(current_positions);

    // compute total force on each FLUID particle (boundary particles stationary)
    for(let i=0; i<num_fluid_points; i++) {
        // FIRST UPDATE VELOCITY WITH VISCOSITY AND GRAVITY
        const a_grav = compute_gravity_force(fluid_points[i].position.clone()); // GRAVITATIONAL FORCE
        const a_viscosity = compute_viscosity_force(i); // viscosity FORCE
        // const a_boundary = compute_boundary_force(fluid_points[i].position.clone()); // BOUNDARY FORCE - try to enforce stronger boundary conditions

        const dv0 = a_grav.clone().add(a_viscosity).multiplyScalar(dt); // .add(a_boundary)
        velocity[i].add( dv0 );
        velocity[i] = clamp_velocity(velocity[i]);
        predicted_positions[i] = fluid_points[i].position.clone().add( velocity[i].clone().multiplyScalar(dt) );

        compute_pressure_acceleration(i)

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
}
renderer.setAnimationLoop( animate );
// **************************************************************************************************



// **************************************************************************************************
// // event variable
// let still = false;
// let full_cubes_visible = true;
// // TODO: Add event listener
// window.addEventListener('keydown', onKeyPress); // onKeyPress is called each time a key is pressed
// // Function to handle keypress
// function onKeyPress(event) {
//     switch (event.key) {
//         case 's': // Note we only do this if s is pressed.
//             still = !still;
//             break;
//         case 'w':
//             full_cubes_visible = !full_cubes_visible;
//             break;
//         default:
//             console.log(`Key ${event.key} pressed`);
//     }
// }
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
    for(let j=0; j<num_fluid_points; j++) {
        if (j == particle_index) {
            continue;
        }
        const j_to_i = fluid_points[j].position.clone().sub(current_position);
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );
        const velocity_diff = velocity[particle_index].clone().sub(velocity[j].clone());
        // params.viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)) * params.viscosity / density[particle_index]));
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
        for(let j=0; j<num_fluid_points; j++) {
            // no self-contribution
            if (j == i) {
                continue;
            }

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

function compute_pressure_acceleration(i) {
    // PRESSURE FORCE: compute gradient of pressure to get acceleration due to pressure -- assumes equation of state p = k * (rho - rho_0)
    pressure_acceleration[i].set(0,0,0);
    const current_position = fluid_points[i].position.clone();

    // fluid contribution
    for(let j=0; j<num_fluid_points; j++) {
        if (j == i) {
            continue;
        }
        const j_to_i = current_position.clone().sub(fluid_points[j].position.clone());
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
    // y = 1
    if (fluid_points[i].position.y > 1 - BUFFER) {
        fluid_points[i].position.y = 1 - BUFFER;
        // all_points[i].position.y = 1 - BUFFER;
        velocity[i].y = -Math.abs(velocity[i].y) * DAMPING;
    }
    // y = 0
    if(fluid_points[i].position.y < 0 + BUFFER) {
        fluid_points[i].position.y = 0 + BUFFER;
        // all_points[i].position.y = 0 + BUFFER;
        velocity[i].y = Math.abs(velocity[i].y) * DAMPING;
    }
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
function get_neighbor_indices(sample_point) {
    let neighbor_indices = [];
    const rSq = params.smoothing_radius ** 2;

    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
                // find cell of sample point
                const sample_cell_coords = addArrays(position_to_cell_coord(sample_point), [di, dj, dk]);
                const cell_key = get_LU_key_from_hash( hash_cell_coord(sample_cell_coords));

                const start_ind = start_indices[cell_key];
                for(let lookup_ind = start_ind; lookup_ind < num_fluid_points; lookup_ind++){
                    // ensure only looking at cell with particle and its neighbors
                    if (spatial_lookup[lookup_ind][1] != cell_key) { break; }

                    // check particle is within smoothing radius
                    const particle_ind = spatial_lookup[lookup_ind][0];
                    const distSq = fluid_points[particle_ind].position.clone().sub(sample_point).lengthSq();
                    if (distSq <= rSq) {
                        neighbor_indices.push(particle_ind);
                    }
                    // neighbor_indices.push(spatial_lookup[lookup_ind][0]); // this is a particle index
                }
            }
        }
    }

    // this works!
    // // find cell of sample point
    // const sample_cell_coords = position_to_cell_coord(sample_point);
    // const cell_key = get_LU_key_from_hash( hash_cell_coord(sample_cell_coords));

    // const start_ind = start_indices[cell_key];
    // for(let lookup_ind = start_ind; lookup_ind < num_fluid_points; lookup_ind++){
    //     if (spatial_lookup[lookup_ind][1] != cell_key) { break; }
    //     neighbor_indices.push(spatial_lookup[lookup_ind][0]); // this is a particle index
    // }




    // // look through sample point cell and all its neighbors
    // for (let i=0; i<3; i++){
    //     for (let j=0; j<3; j++){
    //         for (let k=0; k<3; k++){
    //             const curr_cell_coords = sample_cell_coords + [offsets[i], offsets[j], offsets[k]];

    //             // get key of current cell and look at all points with that key
    //             const curr_cell_key = get_LU_key_from_hash( hash_cell_coord(curr_cell_coords) );
    //             const cell_start_ind = start_indices[curr_cell_key];

    //             for (let lookup_ind = cell_start_ind; lookup_ind < num_fluid_points; lookup_ind++){
    //                 // exit loop if not looking at correct key
    //                 if (spatial_lookup[lookup_ind][1] != curr_cell_key) { break; }

    //                 // particle within smoothing radius
    //                 const particle_ind = spatial_lookup[lookup_ind][0];
    //                 const distSq = fluid_points[particle_ind].position.clone().sub(sample_point).lengthSq();
    //                 if (distSq <= rSq) {
    //                     neighbor_indices.push(particle_ind);
    //                 }
    //             }
    //         }
    //     }
    // }

    return neighbor_indices;
}
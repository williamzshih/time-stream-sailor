// SETUP:
//  npm install --save three    
//  npm install --save-dev vite  
//  npx vite

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { compute } from 'three/tsl';

// // ---------------
// const socket = new WebSocket("ws://localhost:9001");
// socket.binaryType = "arraybuffer";  // Expect binary data

// let particles = [];
// const NUM_PARTICLES = 100;
// // ---------------


const scene = new THREE.Scene();

//THREE.PerspectiveCamera( fov angle, aspect ratio, near depth, far depth );
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

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


// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
// ----------------------------------- SET UP POINTS OF THE FLUID -----------------------------------
const num_fluid_points = 500; // number of points in the fluid
const num_boundary_particles = 100; // number of points on the boundary
const num_points = num_fluid_points + num_boundary_particles; // number of points in the fluid
const point_radius = 0.01; // <= 0.02 good for testing
const point_opacity = 0.7;

// // prettier fluid
// const point_radius = 0.05; // <= 0.02 good for testing
// const point_opacity = 0.2;

// particle properties
const mass = 1;
const mass_boundary = 3;
const stiffness = 0.2;
const viscosity = 100; // mu in equations -- viscosity of the fluid that resists velocity change
const smoothing_radius = 0.2;
const grav_strength = 2.; // strength of gravity
const grav_drop_off_strength = 20; // how quickly gravity drops off when near boundary
const boundary_force_strength = 0.; // strength of boundary force
const boundary_collision_elasticity = 1; // what proportion of velocity is retained after collision with boundary -- THIS OFTEN CAUSES INSTABILITY if not =1
const boundary_buffer = 0.05;

// stability controls
const min_separation = 0.00005; // ** VERY IMPORTANT - minimum separation between particles to prevent division by zero
const max_time_step = 1/60; // maximum time step for physics
const max_velocity = 3; // maximum velocity of fluid points for numerical stability
const BUFFER = 0.001; // Small buffer to prevent sticking
const DAMPING = 0.8;  // Velocity damping factor

// point visualization
const fluid_point_geometry = new THREE.SphereGeometry(point_radius);
const fluid_material = new THREE.MeshBasicMaterial({ color: 0x1AA9D0, opacity: point_opacity, transparent: true,});
const boundary_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: point_opacity, transparent: true,});
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
const total_volume = 1 * 1; // volume of the box
const volume_per_particle = total_volume / num_fluid_points; // volume per particle
const rest_density = mass / volume_per_particle; // rest density of the fluid
const boundary_density = 0.001; // effective density of boundary used for calculating boundary forces

// visualize the box boundary for fluid
const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const wireframe = new THREE.WireframeGeometry( geometry );
const line = new THREE.LineSegments( wireframe );
line.material.depthTest = false;
line.material.opacity = 0.5;
line.material.transparent = true;
line.position.set(0.5,0.5,0.5);
scene.add( line );



// Instantiate the fluid points
let fluid_points = Array.from({length: num_fluid_points}, () => new THREE.Mesh(fluid_point_geometry, fluid_material));
let boundary_points = Array.from({length: num_boundary_particles}, () => new THREE.Mesh(fluid_point_geometry, boundary_material));
// let all_points = fluid_points.concat(boundary_points);

// initialize positions and add to scene
for(let i=0; i<num_fluid_points; i++) {
    fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, 0); // Set position to random in box (0,0,0) - (1,1,1)
	scene.add(fluid_points[i]);
}
const num_points_per_side = num_boundary_particles / 4;
for (let i = 0; i < num_boundary_particles; i++) {

    // y = 0 boundary
    if (i >= 0 && i < num_points_per_side) {
        boundary_points[i].position.set((i % num_points_per_side / num_points_per_side), -boundary_buffer, 0);
    } 
    // x = 1 boundary 
    else if (i >= num_points_per_side && i < 2 * num_points_per_side) {
        boundary_points[i].position.set(1 + boundary_buffer, i % num_points_per_side / num_points_per_side, 0);
    } 
    // y = 1 boundary
    else if (i >= 2 * num_points_per_side && i < 3 * num_points_per_side) {
        boundary_points[i].position.set(1 - i % num_points_per_side / num_points_per_side, 1 + boundary_buffer, 0);
    }
    // x = 0 boundary
    else {
        boundary_points[i].position.set(-boundary_buffer, 1 - i % num_points_per_side / num_points_per_side, 0);
    }
    scene.add(boundary_points[i]);

}


let animation_time = 0;
let dt;
const clock = new THREE.Clock();


// ----------------- Variables to track change across frames -----------------
let density = Array.from({length: num_points}, (v,i) => i < num_fluid_points ? 0 : rest_density); // density of each point
let pressure_acceleration = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0)); // negative gradient of pressure / density, with simple eqn of state p = k * (rho - rho_0)
let velocity = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0));
let mass_array = Array.from({length: num_points}, (v, i) => i < num_fluid_points ? mass : mass_boundary);
let predicted_positions = Array.from({length: num_fluid_points}, () => new THREE.Vector3(0,0,0));

// Render loop
function animate() {
    renderer.render( scene, camera );
    controls.update();

    // update time and delta_t
    // dt = clock.getDelta(); // get time since last frame
    dt = Math.min(clock.getDelta(), max_time_step); // make sure physics time step is sufficiently small
    animation_time += dt; 

    const current_positions = fluid_points.map(p => p.position.clone());
    // i've seen computing density with predicted positions can be unstable
    compute_density(current_positions);

    // compute total force on each FLUID particle (boundary particles stationary)
    for(let i=0; i<num_fluid_points; i++) {
        // FIRST UPDATE VELOCITY WITH VISCOSITY AND GRAVITY
        const a_grav = compute_gravity_force(fluid_points[i].position.clone()); // GRAVITATIONAL FORCE
        const a_viscosity = compute_viscosity_force(i); // VISCOSITY FORCE
        const a_boundary = compute_boundary_force(fluid_points[i].position.clone()); // BOUNDARY FORCE - try to enforce stronger boundary conditions

        const dv0 = a_grav.clone().add(a_viscosity).add(a_boundary).multiplyScalar(dt);
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





// **********************************************************************
// ************************** HELPER FUNCTIONS **************************
// **********************************************************************

const volume = Math.PI * Math.pow(smoothing_radius, 4) / 6; // 2D kernel volume
function kernel2D(dist) {
    if (dist >= smoothing_radius) { return 0; }
    return (smoothing_radius - dist) * (smoothing_radius - dist) / volume;
}

const scale = 12 / (Math.pow(smoothing_radius, 4) * Math.PI);
function kernel2D_deriv(dist) {
    if (dist >= smoothing_radius) { return 0; }
    return (dist - smoothing_radius) * scale;
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
    const y_force = norm_pos.y > 0 ? - grav_strength * ( 1 - Math.exp(-grav_drop_off_strength * (norm_pos.y-0.03)) ) : 0;
    // const y_force = - grav_strength;
    return new THREE.Vector3(0, y_force, 0);
}

// function to compute boundary force
function compute_boundary_force(current_position) {
    const norm_pos = current_position.clone().divideScalar(1); // currently box of size 1
    // const x_force = 1 / ( Math.sin(Math.PI * norm_pos.x)**2 * Math.tan(Math.PI * norm_pos.x) );
    // const y_force = 1 / ( Math.sin(Math.PI * norm_pos.y)**2 * Math.tan(Math.PI * norm_pos.y) );
    const x_force = -Math.sinh(10 * (norm_pos.x - 0.5));
    const y_force = -Math.sinh(10 * (norm_pos.y - 0.5));
    return new THREE.Vector3(x_force, y_force, 0).multiplyScalar(boundary_force_strength / mass);
}

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
        // viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)) * viscosity / density[particle_index]));
    }

    // boundary contribution
    for(let j=0; j<num_boundary_particles; j++) {
        const j_to_i = boundary_points[j].position.clone().sub(current_position);
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );
        const velocity_diff = velocity[particle_index].clone(); // boundary point stationary
        // viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)));
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / Math.max(dist, min_separation)) * viscosity / density[particle_index]));
    }
    return viscosity_force;
}


// ********** COMPUTE DENSITY -- density computed for FLUID points only (boundary set to rest density) **********
function compute_density(fluid_positions_arg) {
    // compute FLUID density rho_i at point x_i due to all points
    for(let i=0; i<num_fluid_points; i++) {
        density[i] = rest_density; // ** VERY IMPORTANT ** -- reset density to REST density of fluid before computing

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

        const pressure_acc = j_to_i.multiplyScalar(- stiffness * kernel_deriv / Math.max(dist, min_separation) * mass_array[j] * (1/density[i] + 1/density[j]));

        // pressure_acceleration[i].add( - stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
        pressure_acceleration[i].add( pressure_acc );
        // pressure_acceleration[i].set(0,0.01,0);
    }
    
    // boundary contribution
    for(let j=0; j<num_boundary_particles; j++) {
        const j_to_i = current_position.clone().sub(boundary_points[j].position.clone());
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );

        const pressure_acc = j_to_i.multiplyScalar(- stiffness * kernel_deriv / Math.max(dist, min_separation) * mass_boundary * (2/density[i])); // approximate boundary with same density as fluid near boundary

        // pressure_acceleration[i].add( - stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
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
    if (fluid_points[i].position.x < 0 + BUFFER) {
        fluid_points[i].position.x = 0 + BUFFER;
        // all_points[i].position.x = 0 + BUFFER;
        velocity[i].x = Math.abs(velocity[i].x) * DAMPING;
    }
    if (fluid_points[i].position.x > 1 - BUFFER) {
        fluid_points[i].position.x = 1 - BUFFER;
        // all_points[i].position.x = 1 - BUFFER;
        velocity[i].x = -Math.abs(velocity[i].x) * DAMPING;
    }
    if (fluid_points[i].position.y > 1 - BUFFER) {
        fluid_points[i].position.y = 1 - BUFFER;
        // all_points[i].position.y = 1 - BUFFER;
        velocity[i].y = -Math.abs(velocity[i].y) * DAMPING;
    }
    if(fluid_points[i].position.y < 0 + BUFFER) {
        fluid_points[i].position.y = 0 + BUFFER;
        // all_points[i].position.y = 0 + BUFFER;
        velocity[i].y = Math.abs(velocity[i].y) * DAMPING;
    }

    // // REVERSE VELOCITY IF POINTS HIT BOUNDARY
    // if (fluid_points[i].position.x < 0) {
    //     fluid_points[i].position.x = 0.;
    //     all_points[i].position.x = 0.;
    //     velocity[i].x *= -boundary_collision_elasticity;
    // }
    // if (fluid_points[i].position.x > 1) {
    //     fluid_points[i].position.x = 1;
    //     all_points[i].position.x = 1;
    //     velocity[i].x *= -boundary_collision_elasticity;
    // }
    // if (fluid_points[i].position.y > 1) {
    //     fluid_points[i].position.y = 1;
    //     all_points[i].position.y = 1;
    //     velocity[i].y *= -boundary_collision_elasticity;
    // }
    // if(fluid_points[i].position.y < 0) {
    //     fluid_points[i].position.y = 0;
    //     all_points[i].position.y = 0;
    //     velocity[i].y *= -boundary_collision_elasticity;
    // }
}
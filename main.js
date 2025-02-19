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
const num_fluid_points = 200; // number of points in the fluid
const num_boundary_particles = 0; // number of points on the boundary
const num_points = num_fluid_points + num_boundary_particles; // number of points in the fluid
const point_radius = 0.01; // <= 0.02 good for testing
const point_opacity = 0.7;

// // prettier fluid
// const point_radius = 0.07; // <= 0.02 good for testing
// const point_opacity = 0.3;

// particle properties
const mass = 1;
const mass_boundary = 1;
const stiffness = 0.06;
const viscosity = 100; // mu in equations -- viscosity of the fluid that resists velocity change
const smoothing_radius = 0.2;
const grav_strength = 0.4; // strength of gravity
const grav_drop_off_strength = 20; // how quickly gravity drops off when near boundary
const boundary_force_strength = 0.; // strength of boundary force
const boundary_collision_elasticity = 1; // what proportion of velocity is retained after collision with boundary -- THIS OFTEN CAUSES INSTABILITY if not =1

// point visualization
const fluid_point_geometry = new THREE.SphereGeometry(point_radius);
const fluid_material = new THREE.MeshBasicMaterial({ color: 0x1AA9D0, opacity: point_opacity, transparent: true,});
const boundary_material = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: point_opacity, transparent: true,});
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
const total_volume = 1 * 1; // volume of the box
const volume_per_particle = total_volume / num_fluid_points; // volume per particle
const rest_density = mass / volume_per_particle; // rest density of the fluid

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
let all_points = fluid_points.concat(boundary_points);

// initialize positions and add to scene
for(let i=0; i<num_fluid_points; i++) {
    fluid_points[i].position.set(Math.random()*0.3 + 0.6, Math.random()*0.4 + 0.2, 0); // Set position to random in box (0,0,0) - (1,1,1)
	scene.add(fluid_points[i]);
}
for (let i = 0; i < num_boundary_particles; i++) {
    const num_points_per_side = num_boundary_particles / 4;

    // y = 0 boundary
    if (i >= 0 && i < num_points_per_side) {
        boundary_points[i].position.set(i % num_points_per_side / num_points_per_side, 0, 0);
    } 
    // x = 1 boundary 
    else if (i >= num_points_per_side && i < 2 * num_points_per_side) {
        boundary_points[i].position.set(1, i % num_points_per_side / num_points_per_side, 0);
    } 
    // y = 1 boundary
    else if (i >= 2 * num_points_per_side && i < 3 * num_points_per_side) {
        boundary_points[i].position.set(1 - i % num_points_per_side / num_points_per_side, 1, 0);
    }
    // x = 0 boundary
    else {
        boundary_points[i].position.set(0, 1 - i % num_points_per_side / num_points_per_side, 0);
    }
    scene.add(boundary_points[i]);

}


let animation_time = 0;
let dt;
const clock = new THREE.Clock();

// HELPER FUNCTIONS
function kernel2D(dist) {
    if (dist >= smoothing_radius) { return 0; }
    const volume = Math.PI * Math.pow(smoothing_radius, 4) / 6; // 2D kernel volume
    return (smoothing_radius - dist) * (smoothing_radius - dist) / volume;
}

function kernel2D_deriv(dist) {
    if (dist >= smoothing_radius) { return 0; }
    const scale = 12 / (Math.pow(smoothing_radius, 4) * Math.PI);
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
    const y_force = - grav_strength * ( 1 - Math.exp(-grav_drop_off_strength * (norm_pos.y-0.03)) );
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
    for(let j=0; j<num_points; j++) {
        if (j == particle_index) {
            continue;
        }
        const j_to_i = all_points[j].position.clone().sub(all_points[particle_index].position.clone());
        const dist = j_to_i.length();
        const kernel_deriv = kernel2D_deriv( dist );
        const velocity_diff = velocity[particle_index].clone().sub(velocity[j].clone());
        // viscosity_force.add( velocity_diff.multiplyScalar( 5 * kernel_deriv * mass_array[j] / density[j]) );
        // const grad_sq_v = velocity_diff.multiplyScalar(mass_array[j] / density[j] * Math.abs(kernel_deriv / dist));
        viscosity_force.add(velocity_diff.multiplyScalar(- mass_array[j] / density[j] * Math.abs(kernel_deriv / dist) * viscosity / density[particle_index]));
    }
    // return new THREE.Vector3(0,0,0);
    return viscosity_force;
}


// ********** COMPUTE DENSITY -- density computed for FLUID points only (boundary set to rest density) **********
function compute_density() {
    for(let i=0; i<num_fluid_points; i++) {
        density[i] = rest_density; // ** VERY IMPORTANT ** -- reset density to REST density of fluid before computing
        // compute FLUID density rho_i at point x_i due to all points

        // density correction factor for this specific fluid particle to account for one layer of boundary particles
        // const boundary_correction_factor = density_correction_factor(i); // seems to be causing instability
        const boundary_correction_factor = mass_boundary / mass;

        for(let j=0; j<num_points; j++) {
            // no self-contribution
            if (j == i) {
                continue;
            }

            // fluid contribution
            if (j < num_fluid_points) {
                const dist = fluid_points[i].position.clone().distanceTo(fluid_points[j].position.clone());
                const kernel_value = kernel2D(dist);
                density[i] += mass * kernel_value;
            }
            // boundary contribution - j is index of a boundary particle
            else {
                const dist = fluid_points[i].position.clone().distanceTo(all_points[j].position.clone());
                const kernel_value = kernel2D(dist);
                density[i] += boundary_correction_factor * mass * kernel_value;
            }
        }
    }
}

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
    dt = clock.getDelta(); // get time since last frame
    animation_time += dt; 

    compute_density();

    // compute total force on each FLUID particle (boundary particles stationary)
    for(let i=0; i<num_fluid_points; i++) {
        // FIRST UPDATE VELOCITY WITH VISCOSITY AND GRAVITY
        // GRAVITATIONAL FORCE
        const a_grav = compute_gravity_force(fluid_points[i].position.clone());
        // VISCOSITY FORCE
        const a_viscosity = compute_viscosity_force(i);

        velocity[i].add( (a_grav.add(a_viscosity)).multiplyScalar(dt) );
        fluid_points[i].position.add( velocity[i].clone().multiplyScalar(dt) );
        all_points[i].position.add( velocity[i].clone().multiplyScalar(dt) );

        // PRESSURE FORCE: compute gradient of pressure to get acceleration due to pressure -- assumes equation of state p = k * (rho - rho_0)
        pressure_acceleration[i].set(0,0,0);
        for(let j=0; j<num_points; j++) {
            if (j == i) {
                continue;
            }
            const j_to_i = all_points[i].position.clone().sub(all_points[j].position.clone());
            const dist = j_to_i.length();
            // const kernel_value = kernel2D( dist );
            const kernel_deriv = kernel2D_deriv( dist );

            const pressure_acc = j_to_i.multiplyScalar(- stiffness * kernel_deriv / dist * mass_array[j] * (1/density[i] + 1/density[j]));

            // pressure_acceleration[i].add( - stiffness * grad_kernel * mass * (1/density[i] + 1/density[j]));
            pressure_acceleration[i].add( pressure_acc );
            // pressure_acceleration[i].set(0,0.01,0);
        }
        // const a_pressure = grad_pressure[i].multiplyScalar(-1/density[i]);
        // BOUNDARY FORCE - try to enforce stronger boundary conditions
        const a_boundary = compute_boundary_force(fluid_points[i].position.clone());


        // ------- update velocity
        fluid_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) ); // go back to before prediction
        all_points[i].position.sub( velocity[i].clone().multiplyScalar(dt) );
        velocity[i].add( (pressure_acceleration[i].clone().add(a_boundary)).multiplyScalar(dt) ); // add

        // update position  
        const dx = velocity[i].clone().multiplyScalar(dt);
        fluid_points[i].position.add( dx );
        all_points[i].position.add( dx );

        // REVERSE VELOCITY IF POINTS HIT BOUNDARY
        if (fluid_points[i].position.x < 0) {
            fluid_points[i].position.x = 0.;
            all_points[i].position.x = 0.;
            velocity[i].x *= -boundary_collision_elasticity;
        }
        if (fluid_points[i].position.x > 1) {
            fluid_points[i].position.x = 1;
            all_points[i].position.x = 1;
            velocity[i].x *= -boundary_collision_elasticity;
        }
        if (fluid_points[i].position.y > 1) {
            fluid_points[i].position.y = 1;
            all_points[i].position.y = 1;
            velocity[i].y *= -boundary_collision_elasticity;
        }
        if(fluid_points[i].position.y < 0) {
            fluid_points[i].position.y = 0;
            all_points[i].position.y = 0;
            velocity[i].y *= -boundary_collision_elasticity;
        }


        // // PERIODIC BOUNDARY CONDITIONS - doesn't compute forces due to peroidicity
        // fluid_points[i].position.x = (fluid_points[i].position.x + 1) % 1;
        // all_points[i].position.x = (all_points[i].position.x + 1) % 1;
        // fluid_points[i].position.y = (fluid_points[i].position.y + 1) % 1;
        // all_points[i].position.y = (all_points[i].position.y + 1) % 1;

        // // RIGID FLOOR BOUNDARY
        // if (fluid_points[i].position.y < 0) {
        //     fluid_points[i].position.y = 0;
        //     velocity[i].y *= -1;
        // }
        
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
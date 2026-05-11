import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/PointerLockControls.js';

// Game State
let isPlaying = false;
let doorOpen = false;
let closetDoorOpen = false;

// UI Elements
const mainMenu = document.getElementById('main-menu');
const startBtn = document.getElementById('start-btn');
const gameUi = document.getElementById('game-ui');
const interactionText = document.getElementById('interaction-text');

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls (First Person)
const controls = new PointerLockControls(camera, document.body);
camera.position.set(0, 3, 0); // Stand in middle of room

startBtn.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => {
    mainMenu.style.display = 'none';
    gameUi.style.display = 'block';
    isPlaying = true;
});

controls.addEventListener('unlock', () => {
    mainMenu.style.display = 'flex';
    gameUi.style.display = 'none';
    isPlaying = false;
    
    // Reset movement keys if menu opens
    move.forward = false; move.backward = false;
    move.left = false; move.right = false;
});

// Movement Keys Setup
const move = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') move.forward = true;
    if(e.code === 'KeyS') move.backward = true;
    if(e.code === 'KeyA') move.left = true;
    if(e.code === 'KeyD') move.right = true;
});
document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') move.forward = false;
    if(e.code === 'KeyS') move.backward = false;
    if(e.code === 'KeyA') move.left = false;
    if(e.code === 'KeyD') move.right = false;
});

// Arrays for logic
const interactables = [];
const colliders = []; // Everything the player can bump into

// Materials
const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); // Brown wood
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

// ===== BUILD ROOM =====

// Floor & Ceiling
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), wallMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 6;
scene.add(ceiling);

// South Wall
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat);
sWall.position.set(0, 3, 5.25);
scene.add(sWall);
colliders.push(sWall);

// East Wall (With Window Hole)
const eastWallGroup = new THREE.Group();
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
eWallLeft.position.set(5.25, 3, -3.25);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
eWallRight.position.set(5.25, 3, 3.25);
eastWallGroup.add(eWallBottom, eWallTop, eWallLeft, eWallRight);
scene.add(eastWallGroup);
colliders.push(eWallBottom, eWallLeft, eWallRight); // Top wall too high to hit

// Window Glass
const windowGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2, 3), 
    new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 })
);
windowGlass.position.set(5.25, 3, 0);
windowGlass.userData = { type: 'window' };
scene.add(windowGlass);
interactables.push(windowGlass);
colliders.push(windowGlass);

// West Wall (With Main Door Hole)
const westWallGroup = new THREE.Group();
const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
wWallTop.position.set(-5.25, 5, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
wWallLeft.position.set(-5.25, 3, -3.25);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
wWallRight.position.set(-5.25, 3, 3.25);
westWallGroup.add(wWallTop, wWallLeft, wWallRight);
scene.add(westWallGroup);
colliders.push(wWallLeft, wWallRight);

// Main Door
const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), new THREE.MeshStandardMaterial({ color: 0x4a3018 }));
door.position.set(-5.25, 2, 0);
door.userData = { type: 'main door' };
scene.add(door);
interactables.push(door);
colliders.push(door);

// Outside West Door Hallway (so you don't fall in the void)
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), floorMat);
hallFloor.rotation.x = -Math.PI / 2;
hallFloor.position.set(-7.5, 0.01, 0);
scene.add(hallFloor);

// Invisible blocker to keep player from walking forever out the door
const hallBlocker = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 3), invisibleMat);
hallBlocker.position.set(-9.5, 5, 0);
scene.add(hallBlocker);
colliders.push(hallBlocker);

// ===== NORTH WALL & CLOSET =====
const northWallGroup = new THREE.Group();
// Left Wall piece
const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(3.5, 6, 0.5), wallMat);
nWallLeft.position.set(-3.25, 3, -5.25);
// Right Wall piece
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(3.5, 6, 0.5), wallMat);
nWallRight.position.set(3.25, 3, -5.25);
// Top Wall piece
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), wallMat);
nWallTop.position.set(0, 5, -5.25);
northWallGroup.add(nWallLeft, nWallRight, nWallTop);
scene.add(northWallGroup);
colliders.push(nWallLeft, nWallRight);

// Closet Door
const closetDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), new THREE.MeshStandardMaterial({ color: 0x3d2314 }));
closetDoor.position.set(0, 2, -5.25);
closetDoor.userData = { type: 'closet door' };
scene.add(closetDoor);
interactables.push(closetDoor);
colliders.push(closetDoor);

// Closet Interior
const closetGroup = new THREE.Group();
const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), floorMat);
cFloor.rotation.x = -Math.PI / 2;
cFloor.position.set(0, 0.01, -7);
const cCeiling = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat);
cCeiling.rotation.x = Math.PI / 2;
cCeiling.position.set(0, 5.99, -7);
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat);
cBack.position.set(0, 3, -8.75);
const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
cLeft.position.set(-1.75, 3, -7);
const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat);
cRight.position.set(1.75, 3, -7);

closetGroup.add(cFloor, cCeiling, cBack, cLeft, cRight);
scene.add(closetGroup);
colliders.push(cBack, cLeft, cRight);

// ===== FURNITURE =====
// Bed (South-East Corner)
const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 4), new THREE.MeshStandardMaterial({ color: 0x223388 }));
bed.position.set(3.5, 0.5, 3);
scene.add(bed);
colliders.push(bed);

const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
pillow.position.set(3.5, 1.25, 4);
scene.add(pillow);

// Dresser (Next to bed)
const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 2), new THREE.MeshStandardMaterial({ color: 0x3d2314 }));
dresser.position.set(1, 1.25, 4);
scene.add(dresser);
colliders.push(dresser);

// Lamp
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x888888 }));
lampBase.position.set(1, 2.75, 4);
scene.add(lampBase);
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffee }));
lampShade.position.set(1, 3.2, 4);
scene.add(lampShade);

// ===== LIGHTING & ENVIRONMENT =====
const ambientLight = new THREE.AmbientLight(0x222222); 
scene.add(ambientLight);

const lampLight = new THREE.PointLight(0xffaa55, 0.8, 15);
lampLight.position.set(1, 3.5, 4);
scene.add(lampLight);

// Dim light in closet
const closetLight = new THREE.PointLight(0x444455, 0.5, 5);
closetLight.position.set(0, 5, -7);
scene.add(closetLight);

// Outside Environment
const outsideGroup = new THREE.Group();
const yard = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0a1c0a }));
yard.rotation.x = -Math.PI / 2;
yard.position.set(15, -0.1, 0);
outsideGroup.add(yard);

for(let i=0; i<15; i++) {
    const fencePost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2), new THREE.MeshStandardMaterial({ color: 0x2d1a0c }));
    fencePost.position.set(15, 1.5, -14 + (i*2));
    outsideGroup.add(fencePost);
}

// Starry Sky
const starsGeom = new THREE.BufferGeometry();
const starsCount = 500;
const posArray = new Float32Array(starsCount * 3);
for(let i=0; i<starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100;
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starsMat = new THREE.PointsMaterial({ size: 0.1, color: 0xffffff });
const starMesh = new THREE.Points(starsGeom, starsMat);
starMesh.position.set(20, 10, 0);
outsideGroup.add(starMesh);

scene.add(outsideGroup);

// ===== INTERACTION LOGIC =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); 

document.addEventListener('mousedown', () => {
    if (!isPlaying) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0 && intersects[0].distance < 4) {
        const object = intersects[0].object;
        
        if (object.userData.type === 'main door') {
            doorOpen = !doorOpen;
            object.position.z = doorOpen ? -2.5 : 0; // slides into wall
            interactionText.innerText = doorOpen ? "*Door Opened*" : "*Door Closed*";
        }

        if (object.userData.type === 'closet door') {
            closetDoorOpen = !closetDoorOpen;
            object.position.x = closetDoorOpen ? 2.5 : 0; // slides right into wall
            interactionText.innerText = closetDoorOpen ? "*Closet Opened*" : "*Closet Closed*";
        }
        
        if (object.userData.type === 'window') {
            interactionText.innerText = "It's pitch black out there... is someone watching?";
        }

        setTimeout(() => interactionText.innerText = "", 2000);
    }
});

// Resize window handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== GAME LOOP & PHYSICS =====
const clock = new THREE.Clock();
const moveSpeed = 6.0;

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        const delta = clock.getDelta();

        // Check for interactables to show hover text
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);
        if (intersects.length > 0 && intersects[0].distance < 4) {
            if(interactionText.innerText === "") {
                interactionText.innerText = `Click to interact with ${intersects[0].object.userData.type}`;
            }
        } else if (interactionText.innerText.includes("Click to interact")) {
            interactionText.innerText = "";
        }

        // --- PLAYER MOVEMENT & COLLISION ---
        let dirZ = Number(move.forward) - Number(move.backward);
        let dirX = Number(move.right) - Number(move.left);

        // Normalize speed for diagonal movement
        if(dirX !== 0 && dirZ !== 0) {
            const length = Math.sqrt(dirX*dirX + dirZ*dirZ);
            dirX /= length;
            dirZ /= length;
        }

        // Save position before moving
        const prevX = camera.position.x;
        const prevZ = camera.position.z;

        // Apply movement natively
        controls.moveForward(dirZ * moveSpeed * delta);
        controls.moveRight(dirX * moveSpeed * delta);

        // Store new intended position
        const newX = camera.position.x;
        const newZ = camera.position.z;

        // Player Bounding Box (A tall box representing the player body)
        const playerBox = new THREE.Box3();
        const checkCollision = () => {
            playerBox.setFromCenterAndSize(
                new THREE.Vector3(camera.position.x, 1.5, camera.position.z), // Center height
                new THREE.Vector3(0.8, 3, 0.8) // Width 0.8, Height 3
            );
            
            for(let collider of colliders) {
                const colliderBox = new THREE.Box3().setFromObject(collider);
                if(playerBox.intersectsBox(colliderBox)) return true;
            }
            return false;
        };

        // Test X Axis Collision
        camera.position.x = newX;
        camera.position.z = prevZ;
        if (checkCollision()) {
            camera.position.x = prevX; // Revert X if we hit a wall
        }

        // Test Z Axis Collision
        camera.position.z = newZ;
        if (checkCollision()) {
            camera.position.z = prevZ; // Revert Z if we hit a wall
        }
        
        // Keep camera locked at head height (no flying/sinking)
        camera.position.y = 3;
    }

    renderer.render(scene, camera);
}

animate();
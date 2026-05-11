import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/PointerLockControls.js';

// Game State
let isPlaying = false;
let doorOpen = false;
let windowBlindsOpen = true;

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

startBtn.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    mainMenu.style.display = 'none';
    gameUi.style.display = 'block';
    isPlaying = true;
});

controls.addEventListener('unlock', () => {
    mainMenu.style.display = 'flex';
    gameUi.style.display = 'none';
    isPlaying = false;
});

// Interactables Array
const interactables = [];

// Materials
const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); // Brown wood
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

// Build Room (10x10)
// Floor
const floorGeom = new THREE.PlaneGeometry(10, 10);
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Ceiling
const ceiling = new THREE.Mesh(floorGeom, wallMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 6;
scene.add(ceiling);

// North Wall
const nWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat);
nWall.position.set(0, 3, -5.25);
scene.add(nWall);

// South Wall
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat);
sWall.position.set(0, 3, 5.25);
scene.add(sWall);

// East Wall (With Window Hole)
const eastWallGroup = new THREE.Group();
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3.5), wallMat);
eWallLeft.position.set(5.25, 3, -3.25);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3.5), wallMat);
eWallRight.position.set(5.25, 3, 3.25);
eastWallGroup.add(eWallBottom, eWallTop, eWallLeft, eWallRight);
scene.add(eastWallGroup);

// Interactable Window Glass
const windowGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2, 3), 
    new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 })
);
windowGlass.position.set(5.25, 3, 0);
windowGlass.userData = { type: 'window' };
scene.add(windowGlass);
interactables.push(windowGlass);

// West Wall (With Door Hole)
const westWallGroup = new THREE.Group();
const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 10), wallMat);
wWallTop.position.set(-5.25, 5, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 3.5), wallMat);
wWallLeft.position.set(-5.25, 2, -3.25);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 3.5), wallMat);
wWallRight.position.set(-5.25, 2, 3.25);
westWallGroup.add(wWallTop, wWallLeft, wWallRight);
scene.add(westWallGroup);

// Interactable Door
const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), new THREE.MeshStandardMaterial({ color: 0x4a3018 }));
door.position.set(-5.25, 2, 0);
door.userData = { type: 'door' };
scene.add(door);
interactables.push(door);

// Furniture: Bed (South-East Corner)
const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 4), new THREE.MeshStandardMaterial({ color: 0x223388 }));
bed.position.set(3.5, 0.5, 3);
scene.add(bed);

const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
pillow.position.set(3.5, 1.25, 4);
scene.add(pillow);

// Furniture: Dresser (Next to bed, South/East area)
const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 2), new THREE.MeshStandardMaterial({ color: 0x3d2314 }));
dresser.position.set(1, 1.25, 4);
scene.add(dresser);

// Furniture: Lamp on Dresser
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x888888 }));
lampBase.position.set(1, 2.75, 4);
scene.add(lampBase);
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffee }));
lampShade.position.set(1, 3.2, 4);
scene.add(lampShade);

// Lighting
const ambientLight = new THREE.AmbientLight(0x222222); // Dim room
scene.add(ambientLight);

// Lamp Light
const lampLight = new THREE.PointLight(0xffaa55, 1, 15);
lampLight.position.set(1, 3.5, 4);
scene.add(lampLight);

// Outside Environment
const outsideGroup = new THREE.Group();
// Yard Grass
const yard = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0a1c0a }));
yard.rotation.x = -Math.PI / 2;
yard.position.set(15, -0.1, 0);
outsideGroup.add(yard);

// Fencing
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

// Raycaster for Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // Center of screen

document.addEventListener('mousedown', () => {
    if (!isPlaying) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0) {
        // Must be close enough to interact
        if (intersects[0].distance < 4) {
            const object = intersects[0].object;
            
            if (object.userData.type === 'door') {
                doorOpen = !doorOpen;
                // Simple slide open/close
                object.position.z = doorOpen ? -2.5 : 0;
                interactionText.innerText = doorOpen ? "*Door Opened*" : "*Door Closed*";
            }
            
            if (object.userData.type === 'window') {
                interactionText.innerText = "It's pitch black out there... is someone watching?";
            }

            // Clear text after 2 seconds
            setTimeout(() => interactionText.innerText = "", 2000);
        }
    }
});

// Resize window handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    // Look for interactables to highlight/show text
    if (isPlaying) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);
        if (intersects.length > 0 && intersects[0].distance < 4) {
            const objType = intersects[0].object.userData.type;
            if(interactionText.innerText === "") {
                interactionText.innerText = `Click to interact with ${objType}`;
            }
        } else {
            if (interactionText.innerText.includes("Click to interact")) {
                interactionText.innerText = "";
            }
        }
    }

    renderer.render(scene, camera);
}

animate();
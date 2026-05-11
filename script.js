import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/PointerLockControls.js';

// Game State
let isPlaying = false;
let gameOver = false;
let gameTime = 0; 
let doorOpen = false;
let closetDoorOpen = false;
let lastTimeString = "";
let mainDoorTargetRot = 0;
let closetDoorTargetRot = 0;

// UI Elements
const mainMenu = document.getElementById('main-menu');
const startBtn = document.getElementById('start-btn');
const gameUi = document.getElementById('game-ui');
const interactionText = document.getElementById('interaction-text');
const sixAmScreen = document.getElementById('six-am-screen');

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
camera.position.set(0, 3, 0);

startBtn.addEventListener('click', () => { if (!gameOver) controls.lock(); });
controls.addEventListener('lock', () => { mainMenu.style.display = 'none'; gameUi.style.display = 'block'; isPlaying = true; });
controls.addEventListener('unlock', () => { if(!gameOver) mainMenu.style.display = 'flex'; gameUi.style.display = 'none'; isPlaying = false; move.forward = false; move.backward = false; move.left = false; move.right = false; });

// Movement
const move = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') move.forward = true; if(e.code === 'KeyS') move.backward = true;
    if(e.code === 'KeyA') move.left = true; if(e.code === 'KeyD') move.right = true;
});
document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') move.forward = false; if(e.code === 'KeyS') move.backward = false;
    if(e.code === 'KeyA') move.left = false; if(e.code === 'KeyD') move.right = false;
});

const interactables = [];
const colliders = [];

// ===== PROCEDURAL TEXTURES =====
function createTexture(type) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    if (type === 'wood') {
        ctx.fillStyle = '#4a3018'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<300; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.15})`; ctx.fillRect(Math.random()*512, 0, Math.random()*4+1, 512); }
    } else if (type === 'wall') {
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<5000; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.04})`; ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2); }
    } else if (type === 'fabric') {
        ctx.fillStyle = '#223388'; ctx.fillRect(0,0,512,512);
        ctx.strokeStyle = `rgba(0,0,0,0.1)`; ctx.lineWidth = 2;
        for(let i=0; i<512; i+=8) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke(); }
    } else if (type === 'metal') {
        const grd = ctx.createLinearGradient(0,0,512,512);
        grd.addColorStop(0, "#888"); grd.addColorStop(0.5, "#eee"); grd.addColorStop(1, "#555");
        ctx.fillStyle = grd; ctx.fillRect(0,0,512,512);
    } else if (type === 'perfectWhiteWood') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,512,512); 
        for(let i=0; i<300; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.03})`; ctx.fillRect(Math.random()*512, 0, Math.random()*4+1, 512); }
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

const wallMat = new THREE.MeshStandardMaterial({ map: createTexture('wall') });
const woodMat = new THREE.MeshStandardMaterial({ map: createTexture('wood') });
const perfectWhiteWoodMat = new THREE.MeshStandardMaterial({ map: createTexture('perfectWhiteWood') });
const fabricMat = new THREE.MeshStandardMaterial({ map: createTexture('fabric') });
const metalMat = new THREE.MeshStandardMaterial({ map: createTexture('metal'), roughness: 0.2, metalness: 0.8 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

// ===== CLOCK CANVAS TEXTURE =====
const clockCanvas = document.createElement('canvas');
clockCanvas.width = 256; clockCanvas.height = 128; 
const clockCtx = clockCanvas.getContext('2d');
const clockTex = new THREE.CanvasTexture(clockCanvas);

function updateClockDisplay(timeStr) {
    clockCtx.fillStyle = '#111'; clockCtx.fillRect(0,0,256,128);
    clockCtx.fillStyle = '#ff0000'; 
    clockCtx.font = 'bold 48px Courier New'; 
    clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle';
    clockCtx.fillText(timeStr, 128, 64); 
    clockTex.needsUpdate = true;
}
updateClockDisplay("12:00 AM");

// ===== BUILD ROOM =====
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), woodMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0; scene.add(floor);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), wallMat); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 6; scene.add(ceiling);
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat); sWall.position.set(0, 3, 5.25); scene.add(sWall); colliders.push(sWall);

const eastWallGroup = new THREE.Group();
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallLeft.position.set(5.25, 3, -3.25);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallRight.position.set(5.25, 3, 3.25);
eastWallGroup.add(eWallBottom, eWallTop, eWallLeft, eWallRight); scene.add(eastWallGroup); colliders.push(eWallBottom, eWallLeft, eWallRight);

const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
windowGlass.position.set(5.25, 3, 0); windowGlass.userData = { type: 'window' }; scene.add(windowGlass); interactables.push(windowGlass); colliders.push(windowGlass);

const westWallGroup = new THREE.Group();
const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); wWallTop.position.set(-5.25, 5.1, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallLeft.position.set(-5.25, 3, -3.35);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallRight.position.set(-5.25, 3, 3.35);
westWallGroup.add(wWallTop, wWallLeft, wWallRight); scene.add(westWallGroup); colliders.push(wWallLeft, wWallRight);

const buildFrame = (x, y, z, rotY) => {
    const frame = new THREE.Group();
    const tFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 3.4), perfectWhiteWoodMat); tFrame.position.set(0, 2.1, 0);
    const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); lFrame.position.set(0, 0, -1.6);
    const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); rFrame.position.set(0, 0, 1.6);
    frame.add(tFrame, lFrame, rFrame); frame.position.set(x, y, z); frame.rotation.y = rotY; scene.add(frame);
}
buildFrame(-5.25, 2, 0, 0); 
buildFrame(-2.0, 2, -5.25, Math.PI/2); 

// Main Door
const mainDoorHinge = new THREE.Group(); mainDoorHinge.position.set(-5.25, 2, -1.5); scene.add(mainDoorHinge);
const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat);
const mKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob1.position.set(0.15, 0, 1.2);
const mKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob2.position.set(-0.15, 0, 1.2);
door.add(mKnob1, mKnob2); door.position.set(0, 0, 1.5); door.userData = { type: 'main door' };
mainDoorHinge.add(door); interactables.push(door); colliders.push(door);

const mainDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), woodMat); mainDoorThreshold.rotation.x = -Math.PI / 2; mainDoorThreshold.position.set(-5.25, 0.01, 0); scene.add(mainDoorThreshold);
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), woodMat); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(-7.5, 0, 0); scene.add(hallFloor);
const hallBlocker = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 3), invisibleMat); hallBlocker.position.set(-9.5, 5, 0); scene.add(hallBlocker); colliders.push(hallBlocker);

// ===== NORTH WALL & CLOSET (SHIFTED WEST) =====
const northWallGroup = new THREE.Group();
const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 0.5), wallMat); nWallLeft.position.set(-4.5, 3, -5.25);
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6, 0.5), wallMat); nWallRight.position.set(2.5, 3, -5.25);
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.5), wallMat); nWallTop.position.set(-2.0, 5.1, -5.25);
northWallGroup.add(nWallLeft, nWallRight, nWallTop); scene.add(northWallGroup); colliders.push(nWallLeft, nWallRight);

const closetDoorHinge = new THREE.Group(); closetDoorHinge.position.set(-3.5, 2, -5.25); scene.add(closetDoorHinge);
const closetDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), perfectWhiteWoodMat);
const cKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob1.position.set(1.2, 0, 0.15);
const cKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob2.position.set(1.2, 0, -0.15);
closetDoor.add(cKnob1, cKnob2); closetDoor.position.set(1.5, 0, 0); closetDoor.userData = { type: 'closet door' };
closetDoorHinge.add(closetDoor); interactables.push(closetDoor); colliders.push(closetDoor);

const closetDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), woodMat); closetDoorThreshold.rotation.x = -Math.PI / 2; closetDoorThreshold.position.set(-2.0, 0.01, -5.25); scene.add(closetDoorThreshold);

const closetGroup = new THREE.Group();
const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), woodMat); cFloor.rotation.x = -Math.PI / 2; cFloor.position.set(-2.0, 0, -7);
const cCeiling = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat); cCeiling.rotation.x = Math.PI / 2; cCeiling.position.set(-2.0, 5.99, -7);
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat); cBack.position.set(-2.0, 3, -8.75);
const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cLeft.position.set(-3.75, 3, -7);
const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cRight.position.set(-0.25, 3, -7);
closetGroup.add(cFloor, cCeiling, cBack, cLeft, cRight); scene.add(closetGroup); colliders.push(cBack, cLeft, cRight);

// ===== DETAILED HANGING CLOTHES & SHELF =====
const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.5), woodMat);
shelf.position.set(-2.0, 5.0, -8.0);
scene.add(shelf);

const clothesRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4), metalMat);
clothesRod.rotation.z = Math.PI / 2; 
clothesRod.position.set(-2.0, 4.7, -7.5);
scene.add(clothesRod);

const clothesData = [
    { type: 'shirt', color: 0x882222 },
    { type: 'pants', color: 0x224488 },
    { type: 'shirt', color: 0x228822 },
    { type: 'pants', color: 0x111111 },
    { type: 'shirt', color: 0xdddddd },
    { type: 'pants', color: 0x886644 },
    { type: 'shirt', color: 0x222288 },
    { type: 'pants', color: 0x333333 },
    { type: 'shirt', color: 0x552255 }
];

for(let i=0; i<9; i++) {
    const itemGroup = new THREE.Group();
    // Center the hook on the rod exactly
    itemGroup.position.set(-3.4 + (i*0.35), 4.7, -7.5);
    // Add a slight messy rotation to make it look realistic
    itemGroup.rotation.y = (Math.random() - 0.5) * 0.15; 

    // Hook (Rotated sideways along Z axis)
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 16, Math.PI), metalMat);
    hook.position.set(0, -0.05, 0); 
    hook.rotation.z = Math.PI; 
    hook.rotation.y = Math.PI / 2;
    
    // Hanger Base (Long part across Z axis)
    const hangerBase = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.4), metalMat);
    hangerBase.position.set(0, -0.15, 0);
    
    let clothing;
    if (clothesData[i].type === 'shirt') {
        clothing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.45), new THREE.MeshStandardMaterial({color: clothesData[i].color, roughness: 0.9}));
        clothing.position.set(0, -0.65, 0); 
    } else { 
        clothing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.35), new THREE.MeshStandardMaterial({color: clothesData[i].color, roughness: 0.9}));
        clothing.position.set(0, -0.55, 0); 
    }
    
    itemGroup.add(hook, hangerBase, clothing);
    scene.add(itemGroup);
}

// ===== FURNITURE =====
const bedGroup = new THREE.Group();
const headboard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.2), woodMat); headboard.position.set(3.5, 1.0, 4.9);
const footboard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.2), woodMat); footboard.position.set(3.5, 0.5, 0.1);
const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 4.6), woodMat); rightRail.position.set(4.9, 0.5, 2.5);
const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 4.6), woodMat); leftRail.position.set(2.1, 0.5, 2.5);
bedGroup.add(headboard, footboard, rightRail, leftRail);
const legPositions = [ [2.2, 0.2, 4.8], [4.8, 0.2, 4.8], [2.2, 0.2, 0.2], [4.8, 0.2, 0.2] ];
legPositions.forEach(pos => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.4), woodMat); leg.position.set(...pos); bedGroup.add(leg); });
const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.6), fabricMat); mattress.position.set(3.5, 0.65, 2.5); bedGroup.add(mattress);
const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffffff })); pillow.scale.set(1.1, 0.2, 0.4); pillow.position.set(3.5, 0.95, 4.2); bedGroup.add(pillow);
scene.add(bedGroup);
const bedCollider = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 5.0), invisibleMat); bedCollider.position.set(3.5, 1.0, 2.5); scene.add(bedCollider); colliders.push(bedCollider);

// FIRST DRESSER (South Wall)
const dresserGroup = new THREE.Group(); dresserGroup.position.set(1, 1.25, 4.5); 
const dresserBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); dresserGroup.add(dresserBody);
for(let i=0; i<3; i++) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drawer.position.set(0, 0.7 - (i*0.8), -0.55); 
    const drawerKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06), metalMat); drawerKnob.position.set(0, 0, -0.05);
    drawer.add(drawerKnob); dresserGroup.add(drawer);
}
scene.add(dresserGroup); colliders.push(dresserBody);

// Lamp (West side of dresser)
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), metalMat); lampBase.position.set(0.4, 2.75, 4.7); scene.add(lampBase);
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffee })); lampShade.position.set(0.4, 3.2, 4.7); scene.add(lampShade);

// DETAILED ALARM CLOCK (East side of dresser)
const clockGroup = new THREE.Group();
clockGroup.position.set(1.6, 2.65, 4.3);
clockGroup.rotation.y = -Math.PI / 16; 
const clockBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.3), new THREE.MeshStandardMaterial({color: 0x1a1a1a}));
clockGroup.add(clockBase);
const screenMat = new THREE.MeshBasicMaterial({map: clockTex});
const darkMat = new THREE.MeshStandardMaterial({color: 0x050505});
const clockFace = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.3, 0.05), [darkMat, darkMat, darkMat, darkMat, darkMat, screenMat]);
clockFace.position.set(0, 0.05, -0.15); 
clockFace.rotation.x = -Math.PI / 8; 
clockGroup.add(clockFace);
const snoozeBtn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), metalMat);
snoozeBtn.position.set(0, 0.17, 0);
clockGroup.add(snoozeBtn);
scene.add(clockGroup);

// SECOND DRESSER & TV (North Wall, Centered on Right Side)
const tvDresserGroup = new THREE.Group(); tvDresserGroup.position.set(2.5, 1.25, -4.5); 
const tvDresserBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); tvDresserGroup.add(tvDresserBody);
for(let i=0; i<3; i++) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drawer.position.set(0, 0.7 - (i*0.8), 0.55); 
    const drawerKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06), metalMat); drawerKnob.position.set(0, 0, 0.05);
    drawer.add(drawerKnob); tvDresserGroup.add(drawer);
}
scene.add(tvDresserGroup); colliders.push(tvDresserBody);

// Detailed Flat Screen TV
const tvGroup = new THREE.Group();
tvGroup.position.set(2.5, 2.5, -4.6);
const tvBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), new THREE.MeshStandardMaterial({color: 0x111}));
tvBase.position.set(0, 0.025, 0);
const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), new THREE.MeshStandardMaterial({color: 0x222}));
tvStand.position.set(0, 0.15, 0);
const tvMonitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), new THREE.MeshStandardMaterial({color: 0x111}));
tvMonitor.position.set(0, 0.7, 0);
const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.02), new THREE.MeshStandardMaterial({color: 0x050508, roughness: 0.1}));
tvScreen.position.set(0, 0.7, 0.05); 
tvGroup.add(tvBase, tvStand, tvMonitor, tvScreen);
scene.add(tvGroup);

// ===== LIGHTING & ENVIRONMENT =====
const ambientLight = new THREE.AmbientLight(0x333333); scene.add(ambientLight);
const lampLight = new THREE.PointLight(0xffaa55, 0.8, 15); lampLight.position.set(0.4, 3.5, 4.7); scene.add(lampLight);
const closetLight = new THREE.PointLight(0x444455, 0.5, 5); closetLight.position.set(-2.0, 5, -7); scene.add(closetLight);

const outsideGroup = new THREE.Group();
const yard = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0a1c0a })); yard.rotation.x = -Math.PI / 2; yard.position.set(15, -0.1, 0); outsideGroup.add(yard);
for(let i=0; i<15; i++) {
    const fencePost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2), woodMat); fencePost.position.set(15, 1.5, -14 + (i*2)); outsideGroup.add(fencePost);
}
const starsGeom = new THREE.BufferGeometry(); const posArray = new Float32Array(500 * 3);
for(let i=0; i<1500; i++) posArray[i] = (Math.random() - 0.5) * 100;
starsGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.1, color: 0xffffff })); starMesh.position.set(20, 10, 0); outsideGroup.add(starMesh);
scene.add(outsideGroup);

// ===== INTERACTION LOGIC =====
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(0, 0); 
document.addEventListener('mousedown', () => {
    if (!isPlaying || gameOver) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length > 0 && intersects[0].distance < 4) {
        const object = intersects[0].object;
        if (object.userData.type === 'main door') {
            doorOpen = !doorOpen; 
            mainDoorTargetRot = doorOpen ? -Math.PI / 2 : 0; 
            interactionText.innerText = doorOpen ? "*Door Opened*" : "*Door Closed*";
        }
        if (object.userData.type === 'closet door') {
            closetDoorOpen = !closetDoorOpen; 
            closetDoorTargetRot = closetDoorOpen ? -Math.PI / 2 : 0; 
            interactionText.innerText = closetDoorOpen ? "*Closet Opened*" : "*Closet Closed*";
        }
        if (object.userData.type === 'window') interactionText.innerText = "It's pitch black out there... is someone watching?";
        setTimeout(() => interactionText.innerText = "", 2000);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== GAME LOOP & TIME SYSTEM =====
const clock = new THREE.Clock();
const moveSpeed = 6.0;

function trigger6AM() {
    gameOver = true; isPlaying = false; controls.unlock(); updateClockDisplay("6:00 AM");
    gameUi.style.display = 'none'; mainMenu.style.display = 'none';
    sixAmScreen.style.display = 'flex';
    setTimeout(() => {
        sixAmScreen.style.opacity = '1';
        setTimeout(() => { sixAmScreen.innerText = "6:00 AM"; }, 1500); 
    }, 100);
}

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying && !gameOver) {
        const delta = clock.getDelta();
        gameTime += delta;

        mainDoorHinge.rotation.y = THREE.MathUtils.lerp(mainDoorHinge.rotation.y, mainDoorTargetRot, delta * 5);
        closetDoorHinge.rotation.y = THREE.MathUtils.lerp(closetDoorHinge.rotation.y, closetDoorTargetRot, delta * 5);

        if (gameTime >= 720) {
            trigger6AM();
        } else {
            const hoursPassed = Math.floor(gameTime / 120);
            const secondsInCurrentHour = gameTime % 120;
            let displayHour = 12 + hoursPassed;
            if (displayHour > 12) displayHour -= 12;
            const displayMinutes = secondsInCurrentHour < 60 ? ":00" : ":30";
            const newTimeString = `${displayHour}${displayMinutes} AM`;
            if (newTimeString !== lastTimeString) {
                lastTimeString = newTimeString;
                updateClockDisplay(lastTimeString);
            }
        }

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);
        if (intersects.length > 0 && intersects[0].distance < 4) {
            if(interactionText.innerText === "") interactionText.innerText = `Click to interact with ${intersects[0].object.userData.type}`;
        } else if (interactionText.innerText.includes("Click to interact")) {
            interactionText.innerText = "";
        }

        let dirZ = Number(move.forward) - Number(move.backward);
        let dirX = Number(move.right) - Number(move.left);
        if(dirX !== 0 && dirZ !== 0) { const length = Math.sqrt(dirX*dirX + dirZ*dirZ); dirX /= length; dirZ /= length; }

        const prevX = camera.position.x; const prevZ = camera.position.z;
        controls.moveForward(dirZ * moveSpeed * delta); controls.moveRight(dirX * moveSpeed * delta);
        const newX = camera.position.x; const newZ = camera.position.z;

        const playerBox = new THREE.Box3();
        const checkCollision = () => {
            playerBox.setFromCenterAndSize(new THREE.Vector3(camera.position.x, 1.5, camera.position.z), new THREE.Vector3(0.8, 3, 0.8));
            for(let collider of colliders) { if(playerBox.intersectsBox(new THREE.Box3().setFromObject(collider))) return true; }
            return false;
        };

        camera.position.x = newX; camera.position.z = prevZ;
        if (checkCollision()) camera.position.x = prevX;
        camera.position.z = newZ;
        if (checkCollision()) camera.position.z = prevZ;
        camera.position.y = 3;
    } else if (!isPlaying && !gameOver) {
        clock.getDelta();
    }

    renderer.render(scene, camera);
}

animate();
import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/PointerLockControls.js';

// Game State
let isPlaying = false;
let gameOver = false;
let gameTime = 0; 
let doorOpen = false;
let closetDoorOpen = false;
let flashlightOn = false;
let lastTimeString = "";
let mainDoorTargetRot = 0;
let closetDoorTargetRot = 0;
let frameCount = 0; 

// UI Elements
const mainMenu = document.getElementById('main-menu');
const startBtn = document.getElementById('start-btn');
const gameUi = document.getElementById('game-ui');
const interactionText = document.getElementById('interaction-text');
const sixAmScreen = document.getElementById('six-am-screen');

const menuText = document.querySelector('#main-menu p');
if(menuText) menuText.innerText = "W,A,S,D to Move | Left Click to Interact | F or Right Click for Flashlight";

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010101); // Near pitch black
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100); 

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Caps resolution to prevent lag on 4K/Retina displays

// ENABLE HIGH-QUALITY SHADOWS
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
camera.position.set(0, 3, 0);
scene.add(camera); 

startBtn.addEventListener('click', () => { if (!gameOver) controls.lock(); });
controls.addEventListener('lock', () => { mainMenu.style.display = 'none'; gameUi.style.display = 'block'; isPlaying = true; });
controls.addEventListener('unlock', () => { if(!gameOver) mainMenu.style.display = 'flex'; gameUi.style.display = 'none'; isPlaying = false; move.forward = false; move.backward = false; move.left = false; move.right = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

const move = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') move.forward = true; if(e.code === 'KeyS') move.backward = true;
    if(e.code === 'KeyA') move.left = true; if(e.code === 'KeyD') move.right = true;
    if(e.code === 'KeyF' && isPlaying && !gameOver) { flashlightOn = !flashlightOn; flashlight.visible = flashlightOn; }
});
document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') move.forward = false; if(e.code === 'KeyS') move.backward = false;
    if(e.code === 'KeyA') move.left = false; if(e.code === 'KeyD') move.right = false;
});

const interactables = [];
const colliders = []; 

// ===== PROCEDURAL PBR TEXTURES (VOXEL / LOW-RES STYLE) =====
function createTexture(type) {
    const c = document.createElement('canvas'); 
    let res = 64; // Low base resolution for chunky pixels
    if (type === 'metal') res = 16;
    if (type === 'fabric') res = 32;
    c.width = res; c.height = res; 
    const ctx = c.getContext('2d');

    if (type === 'wood') {
        ctx.fillStyle = '#4a3018'; ctx.fillRect(0,0,res,res);
        for(let i=0; i<40; i++) { 
            ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.25})`; 
            ctx.fillRect(Math.floor(Math.random()*res), 0, Math.floor(Math.random()*3+1), res); 
        }
    } else if (type === 'wall') {
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,res,res);
        for(let i=0; i<400; i++) { 
            ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.08})`; 
            ctx.fillRect(Math.floor(Math.random()*res), Math.floor(Math.random()*res), 1, 1); 
        }
    } else if (type === 'fabric') {
        ctx.fillStyle = '#223388'; ctx.fillRect(0,0,res,res); 
        ctx.fillStyle = `rgba(0,0,0,0.15)`;
        for(let i=0; i<res; i+=4) { 
            ctx.fillRect(i, 0, 1, res);
            ctx.fillRect(0, i, res, 1);
        }
    } else if (type === 'metal') {
        const grd = ctx.createLinearGradient(0,0,res,res); 
        grd.addColorStop(0, "#888"); grd.addColorStop(0.5, "#eee"); grd.addColorStop(1, "#555");
        ctx.fillStyle = grd; ctx.fillRect(0,0,res,res);
    } else if (type === 'perfectWhiteWood') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,res,res); 
        for(let i=0; i<40; i++) { 
            ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.05})`; 
            ctx.fillRect(Math.floor(Math.random()*res), 0, Math.floor(Math.random()*3+1), res); 
        }
    }
    
    const tex = new THREE.CanvasTexture(c); 
    tex.wrapS = THREE.RepeatWrapping; 
    tex.wrapT = THREE.RepeatWrapping; 
    // THE SECRET TO VOXEL LOOK: NearestFilter disables blurring and keeps pixels sharp and blocky!
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

const wallMat = new THREE.MeshStandardMaterial({ map: createTexture('wall'), roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ map: createTexture('wood'), roughness: 0.8 });
const perfectWhiteWoodMat = new THREE.MeshStandardMaterial({ map: createTexture('perfectWhiteWood'), roughness: 0.8 });
const fabricMat = new THREE.MeshStandardMaterial({ map: createTexture('fabric'), roughness: 1.0 });
const metalMat = new THREE.MeshStandardMaterial({ map: createTexture('metal'), roughness: 0.2, metalness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
const trueVoidMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Pitch black void that ignores flashlight

// ===== CLOCK CANVAS TEXTURE =====
const clockCanvas = document.createElement('canvas'); clockCanvas.width = 128; clockCanvas.height = 64; 
const clockCtx = clockCanvas.getContext('2d'); const clockTex = new THREE.CanvasTexture(clockCanvas);
clockTex.magFilter = THREE.NearestFilter; // Sharp text pixels

function updateClockDisplay(timeStr) {
    clockCtx.fillStyle = '#050505'; clockCtx.fillRect(0,0,128,64);
    clockCtx.fillStyle = '#ff0000'; clockCtx.font = 'bold 24px Courier New'; 
    clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle';
    clockCtx.fillText(timeStr, 64, 32); clockTex.needsUpdate = true;
}
updateClockDisplay("12:00 AM");

// ===== THICK FLOORS & CEILINGS (STOPS LIGHT LEAKS ENTIRELY) =====
// Bedroom
const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1, 10.5), woodMat); bedFloor.position.set(0, -0.5, 0); scene.add(bedFloor);
const bedCeil = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1, 10.5), wallMat); bedCeil.position.set(0, 6.5, 0); scene.add(bedCeil);
// Hallway
const hallFloor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 37), woodMat); hallFloor.position.set(-7.5, -0.5, 11.5); scene.add(hallFloor);
const hallCeil = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 37), wallMat); hallCeil.position.set(-7.5, 6.5, 11.5); scene.add(hallCeil);
// Closet
const cloFloor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 3.5), woodMat); cloFloor.position.set(-2.0, -0.5, -7); scene.add(cloFloor);
const cloCeil = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 3.5), wallMat); cloCeil.position.set(-2.0, 6.5, -7); scene.add(cloCeil);

// ===== BUILD ROOM WALLS =====
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10.5, 6, 0.5), wallMat); sWall.position.set(0, 3, 5.25); scene.add(sWall); colliders.push(sWall);

const eastWallGroup = new THREE.Group();
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.75), wallMat); eWallLeft.position.set(5.25, 3, -3.375);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.75), wallMat); eWallRight.position.set(5.25, 3, 3.375);
eastWallGroup.add(eWallBottom, eWallTop, eWallLeft, eWallRight); scene.add(eastWallGroup); colliders.push(eWallBottom, eWallLeft, eWallRight);

const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
windowGlass.position.set(5.25, 3, 0); windowGlass.userData = { type: 'window' }; scene.add(windowGlass); interactables.push(windowGlass); colliders.push(windowGlass);

const westWallGroup = new THREE.Group();
const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); wWallTop.position.set(-5.25, 5.1, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.55), wallMat); wWallLeft.position.set(-5.25, 3, -3.475);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.55), wallMat); wWallRight.position.set(-5.25, 3, 3.475);
westWallGroup.add(wWallTop, wWallLeft, wWallRight); scene.add(westWallGroup); colliders.push(wWallLeft, wWallRight);

const northWallGroup = new THREE.Group();
const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.55, 6, 0.5), wallMat); nWallLeft.position.set(-4.475, 3, -5.25);
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.55, 6, 0.5), wallMat); nWallRight.position.set(2.475, 3, -5.25);
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.5), wallMat); nWallTop.position.set(-2.0, 5.1, -5.25);
northWallGroup.add(nWallLeft, nWallRight, nWallTop); scene.add(northWallGroup); colliders.push(nWallLeft, nWallRight);

const buildFrame = (x, y, z, rotY) => {
    const frame = new THREE.Group();
    const tFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 3.4), perfectWhiteWoodMat); tFrame.position.set(0, 2.1, 0);
    const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); lFrame.position.set(0, 0, -1.6);
    const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); rFrame.position.set(0, 0, 1.6);
    frame.add(tFrame, lFrame, rFrame); frame.position.set(x, y, z); frame.rotation.y = rotY; scene.add(frame);
}
buildFrame(-5.25, 2, 0, 0); 
buildFrame(-2.0, 2, -5.25, Math.PI/2); 

// ===== DOORS & HINGES =====
const mainDoorHinge = new THREE.Group(); mainDoorHinge.position.set(-5.25, 2, -1.5); scene.add(mainDoorHinge);
const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat);
const mKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); mKnob1.position.set(0.15, 0, 1.2); 
const mKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); mKnob2.position.set(-0.15, 0, 1.2); 
mainDoor.add(mKnob1, mKnob2); mainDoor.position.set(0, 0, 1.5); mainDoor.userData = { type: 'main door' };
mainDoorHinge.add(mainDoor); interactables.push(mainDoor); colliders.push(mainDoor);

const closetDoorHinge = new THREE.Group(); closetDoorHinge.position.set(-3.5, 2, -5.25); scene.add(closetDoorHinge);
const closetDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), perfectWhiteWoodMat);
const cKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); cKnob1.position.set(1.2, 0, 0.15); 
const cKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); cKnob2.position.set(1.2, 0, -0.15); 
closetDoor.add(cKnob1, cKnob2); closetDoor.position.set(1.5, 0, 0); closetDoor.userData = { type: 'closet door' };
closetDoorHinge.add(closetDoor); interactables.push(closetDoor); colliders.push(closetDoor);

const mainDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), woodMat); mainDoorThreshold.rotation.x = -Math.PI / 2; mainDoorThreshold.position.set(-5.25, 0.01, 0); scene.add(mainDoorThreshold);
const closetDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), woodMat); closetDoorThreshold.rotation.x = -Math.PI / 2; closetDoorThreshold.position.set(-2.0, 0.01, -5.25); scene.add(closetDoorThreshold);

// ===== EXTENDED HALLWAY & Z-FIGHTING FIXES =====
const hallGroup = new THREE.Group();

// EAST WALL
const hallWallEastNorth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 2), wallMat); hallWallEastNorth.position.set(-5.25, 3, -6); 
const hallWallEastSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 9.3), wallMat); hallWallEastSeg1.position.set(-5.25, 3, 9.65); 
const hallWallEastSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12.3), wallMat); hallWallEastSeg2.position.set(-5.25, 3, 23.85); 
const hallWallEastTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); hallWallEastTop.position.set(-5.25, 5.1, 16); 

// WEST WALL
const hallWallWestSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 13.3), wallMat); hallWallWestSeg1.position.set(-9.75, 3, -0.35); 
const hallWallWestSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 10.3), wallMat); hallWallWestSeg2.position.set(-9.75, 3, 14.85); 
const hallWallWestSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 6), wallMat); hallWallWestSeg3.position.set(-9.75, 3, 27); 

const hallWallWestTop1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); hallWallWestTop1.position.set(-9.75, 5.1, 8); 
const hallWallWestTop2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 4), wallMat); hallWallWestTop2.position.set(-9.75, 5.5, 22); 

// NORTH & SOUTH END CAPS
const hallWallSouth = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), wallMat); hallWallSouth.position.set(-7.5, 3, 30);
const hallWallNorth = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), wallMat); hallWallNorth.position.set(-7.5, 3, -7);

hallGroup.add(
    hallWallEastNorth, hallWallEastSeg1, hallWallEastSeg2, hallWallEastTop,
    hallWallWestSeg1, hallWallWestSeg2, hallWallWestSeg3, hallWallWestTop1, hallWallWestTop2,
    hallWallSouth, hallWallNorth
); 
scene.add(hallGroup);
colliders.push(hallWallEastNorth, hallWallEastSeg1, hallWallEastSeg2, hallWallWestSeg1, hallWallWestSeg2, hallWallWestSeg3, hallWallSouth, hallWallNorth);

// Fake Doors Factory
const createFakeDoor = () => {
    const fakeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat);
    const knob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); knob1.position.set(0.15, 0, 1.2); 
    const knob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), metalMat); knob2.position.set(-0.15, 0, 1.2); 
    fakeDoor.add(knob1, knob2);
    return fakeDoor;
};

// Fake Door 1 (West Wall)
buildFrame(-9.75, 2, 8, 0); 
const fakeDoor1 = createFakeDoor(); fakeDoor1.position.set(-9.75, 2, 8); 
scene.add(fakeDoor1); colliders.push(fakeDoor1);

// Fake Door 2 (East Wall)
buildFrame(-5.25, 2, 16, 0);
const fakeDoor2 = createFakeDoor(); fakeDoor2.position.set(-5.25, 2, 16);
scene.add(fakeDoor2); colliders.push(fakeDoor2);

// Living Room Doorway & Pitch-Black True Void (West Wall)
const lrEntrance = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5, 4), invisibleMat); lrEntrance.position.set(-9.75, 2.5, 22); scene.add(lrEntrance);
const lrVoid = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 4.5), trueVoidMat); lrVoid.position.set(-11, 3, 22); scene.add(lrVoid);

// Invisible Barrier (Keeps player safe from falling in void)
const hallBarrier = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.5), invisibleMat); hallBarrier.position.set(-7.5, 5, 1.5); scene.add(hallBarrier); colliders.push(hallBarrier);

// ===== CLOSET INTERIOR =====
const closetGroup = new THREE.Group();
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat); cBack.position.set(-2.0, 3, -8.75);
const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cLeft.position.set(-3.75, 3, -7);
const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cRight.position.set(-0.25, 3, -7);
closetGroup.add(cBack, cLeft, cRight); scene.add(closetGroup); colliders.push(cBack, cLeft, cRight);

const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.5), woodMat); shelf.position.set(-2.0, 5.0, -8.0); scene.add(shelf);
const clothesRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 8), metalMat); clothesRod.rotation.z = Math.PI / 2; clothesRod.position.set(-2.0, 4.7, -7.5); scene.add(clothesRod);

const clothesData = [
    { type: 'shirt', color: 0x882222 }, { type: 'pants', color: 0x224488 }, { type: 'shirt', color: 0x228822 }, 
    { type: 'pants', color: 0x111111 }, { type: 'shirt', color: 0xdddddd }, { type: 'pants', color: 0x886644 },
    { type: 'shirt', color: 0x222288 }, { type: 'pants', color: 0x333333 }, { type: 'shirt', color: 0x552255 }
];

for(let i=0; i<9; i++) {
    const itemGroup = new THREE.Group(); itemGroup.position.set(-3.4 + (i*0.35), 4.7, -7.5); itemGroup.rotation.y = (Math.random() - 0.5) * 0.15; 
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 4, 8, Math.PI), metalMat); hook.position.set(0, -0.05, 0); hook.rotation.z = Math.PI; hook.rotation.y = Math.PI / 2;
    const hangerBase = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.4), metalMat); hangerBase.position.set(0, -0.15, 0);
    let clothing = new THREE.Mesh(new THREE.BoxGeometry(0.12, clothesData[i].type === 'shirt' ? 1.0 : 0.8, clothesData[i].type === 'shirt' ? 0.45 : 0.35), new THREE.MeshStandardMaterial({color: clothesData[i].color, roughness: 0.9}));
    clothing.position.set(0, clothesData[i].type === 'shirt' ? -0.65 : -0.55, 0); 
    itemGroup.add(hook, hangerBase, clothing); scene.add(itemGroup);
}

// ===== FURNITURE =====
const bedGroup = new THREE.Group();
const headboard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.2), woodMat); headboard.position.set(3.5, 1.0, 4.9);
const footboard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.2), woodMat); footboard.position.set(3.5, 0.5, 0.1);
const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 4.6), woodMat); rightRail.position.set(4.9, 0.5, 2.5);
const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 4.6), woodMat); leftRail.position.set(2.1, 0.5, 2.5);
bedGroup.add(headboard, footboard, rightRail, leftRail);

[ [2.2, 0.2, 4.8], [4.8, 0.2, 4.8], [2.2, 0.2, 0.2], [4.8, 0.2, 0.2] ].forEach(pos => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.4, 8), woodMat); leg.position.set(...pos); bedGroup.add(leg); });

const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.6), fabricMat); mattress.position.set(3.5, 0.65, 2.5); bedGroup.add(mattress);
const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: 0xffffff })); pillow.scale.set(1.1, 0.2, 0.4); pillow.position.set(3.5, 0.95, 4.2); bedGroup.add(pillow);

scene.add(bedGroup);
const bedCollider = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 5.0), invisibleMat); bedCollider.position.set(3.5, 1.0, 2.5); scene.add(bedCollider); colliders.push(bedCollider);

const dresserGroup = new THREE.Group(); dresserGroup.position.set(1, 1.25, 4.5); 
const dresserBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); dresserGroup.add(dresserBody);
for(let i=0; i<3; i++) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drawer.position.set(0, 0.7 - (i*0.8), -0.55); 
    const drawerKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), metalMat); drawerKnob.position.set(0, 0, -0.05); drawer.add(drawerKnob); dresserGroup.add(drawer);
}
scene.add(dresserGroup); colliders.push(dresserBody);

const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), metalMat); lampBase.position.set(0.4, 2.75, 4.7); scene.add(lampBase);
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xffffee, roughness: 0.8 })); lampShade.position.set(0.4, 3.2, 4.7); scene.add(lampShade);

const clockGroup = new THREE.Group(); clockGroup.position.set(1.6, 2.6, 4.5); clockGroup.rotation.y = -0.15; 
const clockBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), darkMat); clockGroup.add(clockBase);
const screenMat = new THREE.MeshBasicMaterial({map: clockTex});
const clockFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.32, 0.05), [darkMat, darkMat, darkMat, darkMat, darkMat, screenMat]);
clockFace.position.set(0, 0.05, -0.22); clockFace.rotation.x = 0.3; clockGroup.add(clockFace);
const snoozeBtn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.15), metalMat); snoozeBtn.position.set(0, 0.2, 0); clockGroup.add(snoozeBtn);
scene.add(clockGroup);

const tvDresserGroup = new THREE.Group(); tvDresserGroup.position.set(2.5, 1.25, -4.5); 
const tvDresserBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); tvDresserGroup.add(tvDresserBody);
for(let i=0; i<3; i++) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drawer.position.set(0, 0.7 - (i*0.8), 0.55); 
    const drawerKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), metalMat); drawerKnob.position.set(0, 0, 0.05); drawer.add(drawerKnob); tvDresserGroup.add(drawer);
}
scene.add(tvDresserGroup); colliders.push(tvDresserBody);

const tvGroup = new THREE.Group(); tvGroup.position.set(2.5, 2.5, -4.6);
const tvBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), darkMat); tvBase.position.set(0, 0.025, 0);
const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), darkMat); tvStand.position.set(0, 0.15, 0);
const tvMonitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), darkMat); tvMonitor.position.set(0, 0.7, 0);
const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.02), new THREE.MeshStandardMaterial({color: 0x050508})); tvScreen.position.set(0, 0.7, 0.05); 
tvGroup.add(tvBase, tvStand, tvMonitor, tvScreen); scene.add(tvGroup);

// ===== OUTSIDE & STARS =====
const outsideGroup = new THREE.Group();
const yard = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x0a1c0a })); 
yard.rotation.x = -Math.PI / 2; yard.position.set(15, -0.1, 20); outsideGroup.add(yard);

// Extra long fence
for(let i=0; i<80; i++) {
    const fencePost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2), woodMat); 
    fencePost.position.set(15, 1.5, -60 + (i*2)); 
    outsideGroup.add(fencePost);
}

const starsGeom = new THREE.BufferGeometry();
const starsCount = 400; const starPosArr = new Float32Array(starsCount * 3);
for(let i=0; i < starsCount; i++) {
    const radius = 40 + Math.random() * 2; const theta = Math.random() * Math.PI; const phi = Math.random() * Math.PI * 2; 
    starPosArr[i*3] = radius * Math.sin(theta) * Math.cos(phi); starPosArr[i*3+1] = Math.abs(radius * Math.sin(theta) * Math.sin(phi)) + 5; starPosArr[i*3+2] = radius * Math.cos(theta);
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
outsideGroup.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff })));
scene.add(outsideGroup);

// ===== LIGHTING & SHADOWS =====
const moonLight = new THREE.DirectionalLight(0x224488, 0.3); 
moonLight.position.set(20, 20, -5); 
moonLight.target.position.set(0, 0, 0); 
moonLight.castShadow = true;
moonLight.shadow.camera.left = -40; moonLight.shadow.camera.right = 40;
moonLight.shadow.camera.top = 40; moonLight.shadow.camera.bottom = -40;
moonLight.shadow.mapSize.width = 1024; moonLight.shadow.mapSize.height = 1024;
moonLight.shadow.bias = -0.002;
moonLight.shadow.normalBias = 0.05;
scene.add(moonLight); scene.add(moonLight.target);

// Capped distance ensures no light leaks into the hall
const lampLight = new THREE.PointLight(0xffaa55, 0.8, 7.0); 
lampLight.position.set(0.4, 3.5, 4.7); 
lampLight.castShadow = true;
lampLight.shadow.mapSize.width = 512; lampLight.shadow.mapSize.height = 512;
lampLight.shadow.bias = -0.001; lampLight.shadow.normalBias = 0.05; 
scene.add(lampLight);

const closetLight = new THREE.PointLight(0x444455, 0.5, 4.0); 
closetLight.position.set(-2.0, 5, -7); 
scene.add(closetLight);

const flashlight = new THREE.SpotLight(0xfff5e6, 1.5, 40, Math.PI / 6, 0.5, 2);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1); 
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 1024;
flashlight.shadow.mapSize.height = 1024;
flashlight.shadow.bias = -0.0005; 
flashlight.shadow.normalBias = 0.02; 
flashlight.visible = flashlightOn;

camera.add(flashlight);
camera.add(flashlight.target);

// APPLY SHADOWS
scene.traverse((child) => {
    if (child.isMesh && child.material !== invisibleMat && child.material !== darkMat && child.material !== trueVoidMat) {
        if (child.userData.type === 'window') {
            child.receiveShadow = true; 
        } else { 
            child.castShadow = true; child.receiveShadow = true; 
        }
    }
});

// ===== INTERACTION LOGIC =====
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(0, 0); 
document.addEventListener('mousedown', (e) => {
    if (!isPlaying || gameOver) return;
    
    if (e.button === 2) {
        flashlightOn = !flashlightOn;
        flashlight.visible = flashlightOn;
        return;
    }
    
    if (e.button !== 0) return; 
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length > 0 && intersects[0].distance < 4) {
        const object = intersects[0].object;
        if (object.userData.type === 'main door') { doorOpen = !doorOpen; mainDoorTargetRot = doorOpen ? -Math.PI / 2 : 0; interactionText.innerText = doorOpen ? "*Door Opened*" : "*Door Closed*"; }
        if (object.userData.type === 'closet door') { closetDoorOpen = !closetDoorOpen; closetDoorTargetRot = closetDoorOpen ? -Math.PI / 2 : 0; interactionText.innerText = closetDoorOpen ? "*Closet Opened*" : "*Closet Closed*"; }
        if (object.userData.type === 'window') interactionText.innerText = "It's pitch black out there... is someone watching?";
        setTimeout(() => interactionText.innerText = "", 2000);
    }
});
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// ===== GAME LOOP =====
const clock = new THREE.Clock(); const moveSpeed = 6.0;

const playerBox = new THREE.Box3();
const pSize = new THREE.Vector3(0.8, 3, 0.8);
const pCenter = new THREE.Vector3();

function trigger6AM() {
    gameOver = true; isPlaying = false; controls.unlock(); updateClockDisplay("6:00 AM");
    gameUi.style.display = 'none'; mainMenu.style.display = 'none'; sixAmScreen.style.display = 'flex';
    setTimeout(() => { sixAmScreen.style.opacity = '1'; setTimeout(() => { sixAmScreen.innerText = "6:00 AM"; }, 1500); }, 100);
}

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying && !gameOver) {
        const delta = clock.getDelta(); gameTime += delta; frameCount++;

        mainDoorHinge.rotation.y = THREE.MathUtils.lerp(mainDoorHinge.rotation.y, mainDoorTargetRot, delta * 5);
        closetDoorHinge.rotation.y = THREE.MathUtils.lerp(closetDoorHinge.rotation.y, closetDoorTargetRot, delta * 5);
        
        // Auto-close Proximity Logic 
        if (doorOpen && camera.position.distanceTo(mainDoorHinge.position) > 6) { doorOpen = false; mainDoorTargetRot = 0; }
        if (closetDoorOpen && camera.position.distanceTo(closetDoorHinge.position) > 6) { closetDoorOpen = false; closetDoorTargetRot = 0; }

        if (gameTime >= 720) trigger6AM();
        else {
            const hoursPassed = Math.floor(gameTime / 120); const secondsInCurrentHour = gameTime % 120;
            let displayHour = 12 + hoursPassed; if (displayHour > 12) displayHour -= 12;
            const newTimeString = `${displayHour}${secondsInCurrentHour < 60 ? ":00" : ":30"} AM`;
            if (newTimeString !== lastTimeString) { lastTimeString = newTimeString; updateClockDisplay(lastTimeString); }
        }

        // Raycasting Logic
        if (frameCount % 4 === 0) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactables);
            if (intersects.length > 0 && intersects[0].distance < 4) {
                if(interactionText.innerText === "") interactionText.innerText = `Click to interact with ${intersects[0].object.userData.type}`;
            } else if (interactionText.innerText.includes("Click to interact")) interactionText.innerText = "";
        }

        let dirZ = Number(move.forward) - Number(move.backward); let dirX = Number(move.right) - Number(move.left);
        if(dirX !== 0 && dirZ !== 0) { const length = Math.sqrt(dirX*dirX + dirZ*dirZ); dirX /= length; dirZ /= length; }

        const prevX = camera.position.x; const prevZ = camera.position.z;
        controls.moveForward(dirZ * moveSpeed * delta); controls.moveRight(dirX * moveSpeed * delta);
        const newX = camera.position.x; const newZ = camera.position.z;

        const checkCollision = () => {
            pCenter.set(camera.position.x, 1.5, camera.position.z);
            playerBox.setFromCenterAndSize(pCenter, pSize);
            for(let i=0; i < colliders.length; i++) { 
                if(playerBox.intersectsBox(new THREE.Box3().setFromObject(colliders[i]))) return true; 
            }
            return false;
        };

        camera.position.x = newX; camera.position.z = prevZ; if (checkCollision()) camera.position.x = prevX;
        camera.position.z = newZ; if (checkCollision()) camera.position.z = prevZ; camera.position.y = 3;
        
    } else if (!isPlaying && !gameOver) clock.getDelta(); 

    renderer.render(scene, camera);
}
animate();
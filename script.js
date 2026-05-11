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

// ===== SCENE & MINECRAFT PBR RENDERER =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);

// Render distance optimized to unload chunks outside view
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 80); 

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 

// Bedrock PBR Shadow Settings
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
const staticColliders = [];
const dynamicColliders = []; 

// ===== PROCEDURAL PBR TEXTURES =====
function createTexture(type) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; 
    const ctx = c.getContext('2d');
    if (type === 'wood') {
        ctx.fillStyle = '#4a3018'; ctx.fillRect(0,0,256,256);
        for(let i=0; i<150; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.15})`; ctx.fillRect(Math.random()*256, 0, Math.random()*3+1, 256); }
    } else if (type === 'wall') {
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,256,256);
        for(let i=0; i<2500; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.04})`; ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2); }
    } else if (type === 'fabric') {
        ctx.fillStyle = '#223388'; ctx.fillRect(0,0,256,256); ctx.strokeStyle = `rgba(0,0,0,0.1)`; ctx.lineWidth = 2;
        for(let i=0; i<256; i+=8) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke(); }
    } else if (type === 'metal') {
        const grd = ctx.createLinearGradient(0,0,256,256); grd.addColorStop(0, "#888"); grd.addColorStop(0.5, "#eee"); grd.addColorStop(1, "#555");
        ctx.fillStyle = grd; ctx.fillRect(0,0,256,256);
    } else if (type === 'perfectWhiteWood') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,256,256); 
        for(let i=0; i<150; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.03})`; ctx.fillRect(Math.random()*256, 0, Math.random()*3+1, 256); }
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

// RESTORED PBR MATERIALS
const wallMat = new THREE.MeshStandardMaterial({ map: createTexture('wall'), roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ map: createTexture('wood'), roughness: 0.8 });
const perfectWhiteWoodMat = new THREE.MeshStandardMaterial({ map: createTexture('perfectWhiteWood'), roughness: 0.8 });
const fabricMat = new THREE.MeshStandardMaterial({ map: createTexture('fabric'), roughness: 1.0 });
const metalMat = new THREE.MeshStandardMaterial({ map: createTexture('metal'), roughness: 0.2, metalness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

// ===== CLOCK CANVAS TEXTURE =====
const clockCanvas = document.createElement('canvas'); clockCanvas.width = 256; clockCanvas.height = 128; 
const clockCtx = clockCanvas.getContext('2d'); const clockTex = new THREE.CanvasTexture(clockCanvas);

function updateClockDisplay(timeStr) {
    clockCtx.fillStyle = '#050505'; clockCtx.fillRect(0,0,256,128);
    clockCtx.fillStyle = '#ff0000'; clockCtx.font = 'bold 50px Courier New'; 
    clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle';
    clockCtx.fillText(timeStr, 128, 64); clockTex.needsUpdate = true;
}
updateClockDisplay("12:00 AM");

// ===== BUILD ROOM =====
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), woodMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0; scene.add(floor);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), wallMat); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 6; scene.add(ceiling);
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat); sWall.position.set(0, 3, 5.25); scene.add(sWall); staticColliders.push(sWall);

const eastWallGroup = new THREE.Group();
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallLeft.position.set(5.25, 3, -3.25);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallRight.position.set(5.25, 3, 3.25);
eastWallGroup.add(eWallBottom, eWallTop, eWallLeft, eWallRight); scene.add(eastWallGroup); staticColliders.push(eWallBottom, eWallLeft, eWallRight);

const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
windowGlass.position.set(5.25, 3, 0); windowGlass.userData = { type: 'window' }; scene.add(windowGlass); interactables.push(windowGlass); staticColliders.push(windowGlass);

const westWallGroup = new THREE.Group();
const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); wWallTop.position.set(-5.25, 5.1, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallLeft.position.set(-5.25, 3, -3.35);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallRight.position.set(-5.25, 3, 3.35);
westWallGroup.add(wWallTop, wWallLeft, wWallRight); scene.add(westWallGroup); staticColliders.push(wWallLeft, wWallRight);

const northWallGroup = new THREE.Group();
const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 0.5), wallMat); nWallLeft.position.set(-4.5, 3, -5.25);
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6, 0.5), wallMat); nWallRight.position.set(2.5, 3, -5.25);
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.5), wallMat); nWallTop.position.set(-2.0, 5.1, -5.25);
northWallGroup.add(nWallLeft, nWallRight, nWallTop); scene.add(northWallGroup); staticColliders.push(nWallLeft, nWallRight);

const buildFrame = (x, y, z, rotY) => {
    const frame = new THREE.Group();
    const tFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 3.4), perfectWhiteWoodMat); tFrame.position.set(0, 2.1, 0);
    const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); lFrame.position.set(0, 0, -1.6);
    const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); rFrame.position.set(0, 0, 1.6);
    frame.add(tFrame, lFrame, rFrame); frame.position.set(x, y, z); frame.rotation.y = rotY; scene.add(frame);
}
buildFrame(-5.25, 2, 0, 0); buildFrame(-2.0, 2, -5.25, Math.PI/2); 

// ===== DOORS & HINGES =====
const mainDoorHinge = new THREE.Group(); mainDoorHinge.position.set(-5.25, 2, -1.5); scene.add(mainDoorHinge);
const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat);
const mKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob1.position.set(0.15, 0, 1.2); 
const mKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob2.position.set(-0.15, 0, 1.2); 
mainDoor.add(mKnob1, mKnob2); mainDoor.position.set(0, 0, 1.5); mainDoor.userData = { type: 'main door' };
mainDoorHinge.add(mainDoor); interactables.push(mainDoor); dynamicColliders.push(mainDoor);

const closetDoorHinge = new THREE.Group(); closetDoorHinge.position.set(-3.5, 2, -5.25); scene.add(closetDoorHinge);
const closetDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), perfectWhiteWoodMat);
const cKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob1.position.set(1.2, 0, 0.15); 
const cKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob2.position.set(1.2, 0, -0.15); 
closetDoor.add(cKnob1, cKnob2); closetDoor.position.set(1.5, 0, 0); closetDoor.userData = { type: 'closet door' };
closetDoorHinge.add(closetDoor); interactables.push(closetDoor); dynamicColliders.push(closetDoor);

const mainDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), woodMat); mainDoorThreshold.rotation.x = -Math.PI / 2; mainDoorThreshold.position.set(-5.25, 0.01, 0); scene.add(mainDoorThreshold);
const closetDoorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), woodMat); closetDoorThreshold.rotation.x = -Math.PI / 2; closetDoorThreshold.position.set(-2.0, 0.01, -5.25); scene.add(closetDoorThreshold);

// ===== EXTENDED HALLWAY =====
const hallGroup = new THREE.Group();
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(4, 37), woodMat); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(-7.5, 0.01, 11.5);
const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(4, 37), wallMat); hallCeil.rotation.x = Math.PI / 2; hallCeil.position.set(-7.5, 5.99, 11.5);

const hallWallEastNorth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 2), wallMat); hallWallEastNorth.position.set(-5.25, 3, -6); 
const hallWallEastSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 9.3), wallMat); hallWallEastSeg1.position.set(-5.25, 3, 9.65); 
const hallWallEastSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12.3), wallMat); hallWallEastSeg2.position.set(-5.25, 3, 23.85); 
const hallWallEastTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); hallWallEastTop.position.set(-5.25, 5.1, 16); 

const hallWallWestSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 13.3), wallMat); hallWallWestSeg1.position.set(-9.75, 3, -0.35); 
const hallWallWestSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 10.3), wallMat); hallWallWestSeg2.position.set(-9.75, 3, 14.85); 
const hallWallWestSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 6), wallMat); hallWallWestSeg3.position.set(-9.75, 3, 27); 

const hallWallWestTop1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); hallWallWestTop1.position.set(-9.75, 5.1, 8); 
const hallWallWestTop2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 4), wallMat); hallWallWestTop2.position.set(-9.75, 5.5, 22); 

const hallWallSouth = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), wallMat); hallWallSouth.position.set(-7.5, 3, 30);
const hallWallNorth = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), wallMat); hallWallNorth.position.set(-7.5, 3, -7);

hallGroup.add(hallFloor, hallCeil, hallWallEastNorth, hallWallEastSeg1, hallWallEastSeg2, hallWallEastTop, hallWallWestSeg1, hallWallWestSeg2, hallWallWestSeg3, hallWallWestTop1, hallWallWestTop2, hallWallSouth, hallWallNorth); 
scene.add(hallGroup);
staticColliders.push(hallWallEastNorth, hallWallEastSeg1, hallWallEastSeg2, hallWallWestSeg1, hallWallWestSeg2, hallWallWestSeg3, hallWallSouth, hallWallNorth);

const fGeo = new THREE.BoxGeometry(0.2, 4, 3); const fKnob = new THREE.SphereGeometry(0.08);
const createFakeDoor = () => {
    const fDoor = new THREE.Mesh(fGeo, woodMat);
    const k1 = new THREE.Mesh(fKnob, metalMat); k1.position.set(0.15, 0, 1.2); 
    const k2 = new THREE.Mesh(fKnob, metalMat); k2.position.set(-0.15, 0, 1.2); 
    fDoor.add(k1, k2); return fDoor;
};
buildFrame(-9.75, 2, 8, 0); const fakeDoor1 = createFakeDoor(); fakeDoor1.position.set(-9.75, 2, 8); scene.add(fakeDoor1); staticColliders.push(fakeDoor1);
buildFrame(-5.25, 2, 16, 0); const fakeDoor2 = createFakeDoor(); fakeDoor2.position.set(-5.25, 2, 16); scene.add(fakeDoor2); staticColliders.push(fakeDoor2);

const lrEntrance = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5, 4), invisibleMat); lrEntrance.position.set(-9.75, 2.5, 22); scene.add(lrEntrance);
const lrVoid = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 4.5), darkMat); lrVoid.position.set(-11, 3, 22); scene.add(lrVoid);
const hallBarrier = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.5), invisibleMat); hallBarrier.position.set(-7.5, 5, 1.5); scene.add(hallBarrier); staticColliders.push(hallBarrier);

// ===== CLOSET INTERIOR =====
const closetGroup = new THREE.Group();
const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), woodMat); cFloor.rotation.x = -Math.PI / 2; cFloor.position.set(-2.0, 0, -7);
const cCeiling = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat); cCeiling.rotation.x = Math.PI / 2; cCeiling.position.set(-2.0, 5.99, -7);
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat); cBack.position.set(-2.0, 3, -8.75);
const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cLeft.position.set(-3.75, 3, -7);
const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.0), wallMat); cRight.position.set(-0.25, 3, -7);
closetGroup.add(cFloor, cCeiling, cBack, cLeft, cRight); scene.add(closetGroup); staticColliders.push(cBack, cLeft, cRight);

const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.5), woodMat); shelf.position.set(-2.0, 5.0, -8.0); scene.add(shelf);
const clothesRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4), metalMat); clothesRod.rotation.z = Math.PI / 2; clothesRod.position.set(-2.0, 4.7, -7.5); scene.add(clothesRod);

const hookGeo = new THREE.TorusGeometry(0.06, 0.01, 8, 16, Math.PI);
const hBaseGeo = new THREE.BoxGeometry(0.02, 0.02, 0.4);
const shirtGeo = new THREE.BoxGeometry(0.12, 1.0, 0.45);
const pantsGeo = new THREE.BoxGeometry(0.1, 0.8, 0.35);

const clothesData = [
    { type: 'shirt', color: 0x882222 }, { type: 'pants', color: 0x224488 }, { type: 'shirt', color: 0x228822 }, 
    { type: 'pants', color: 0x111111 }, { type: 'shirt', color: 0xdddddd }, { type: 'pants', color: 0x886644 },
    { type: 'shirt', color: 0x222288 }, { type: 'pants', color: 0x333333 }, { type: 'shirt', color: 0x552255 }
];

for(let i=0; i<9; i++) {
    const itemGroup = new THREE.Group(); itemGroup.position.set(-3.4 + (i*0.35), 4.7, -7.5); itemGroup.rotation.y = (Math.random() - 0.5) * 0.15; 
    const hook = new THREE.Mesh(hookGeo, metalMat); hook.position.set(0, -0.05, 0); hook.rotation.z = Math.PI; hook.rotation.y = Math.PI / 2; 
    const hangerBase = new THREE.Mesh(hBaseGeo, metalMat); hangerBase.position.set(0, -0.15, 0); 
    let clothing = new THREE.Mesh(clothesData[i].type === 'shirt' ? shirtGeo : pantsGeo, new THREE.MeshStandardMaterial({color: clothesData[i].color, roughness: 0.9}));
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

const legGeo = new THREE.CylinderGeometry(0.08, 0.04, 0.4);
[ [2.2, 0.2, 4.8], [4.8, 0.2, 4.8], [2.2, 0.2, 0.2], [4.8, 0.2, 0.2] ].forEach(pos => { 
    const leg = new THREE.Mesh(legGeo, woodMat); leg.position.set(...pos); bedGroup.add(leg); 
});

const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.6), fabricMat); mattress.position.set(3.5, 0.65, 2.5); bedGroup.add(mattress);
const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffffff })); pillow.scale.set(1.1, 0.2, 0.4); pillow.position.set(3.5, 0.95, 4.2); bedGroup.add(pillow);

scene.add(bedGroup);
const bedCollider = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 5.0), invisibleMat); bedCollider.position.set(3.5, 1.0, 2.5); scene.add(bedCollider); staticColliders.push(bedCollider);

const drawerGeom = new THREE.BoxGeometry(1.8, 0.7, 0.1);

const dresserGroup = new THREE.Group(); dresserGroup.position.set(1, 1.25, 4.5); 
const dresserBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); dresserGroup.add(dresserBody);
for(let i=0; i<3; i++) {
    const drawer = new THREE.Mesh(drawerGeom, woodMat); drawer.position.set(0, 0.7 - (i*0.8), -0.55); 
    const drawerKnob = new THREE.Mesh(fKnob, metalMat); drawerKnob.position.set(0, 0, -0.05); 
    drawer.add(drawerKnob); dresserGroup.add(drawer);
}
scene.add(dresserGroup); staticColliders.push(dresserBody);

const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), metalMat); lampBase.position.set(0.4, 2.75, 4.7); scene.add(lampBase);
const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffee })); lampShade.position.set(0.4, 3.2, 4.7); scene.add(lampShade);

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
    const drawer = new THREE.Mesh(drawerGeom, woodMat); drawer.position.set(0, 0.7 - (i*0.8), 0.55); 
    const drawerKnob = new THREE.Mesh(fKnob, metalMat); drawerKnob.position.set(0, 0, 0.05); 
    drawer.add(drawerKnob); tvDresserGroup.add(drawer);
}
scene.add(tvDresserGroup); staticColliders.push(tvDresserBody);

const tvGroup = new THREE.Group(); tvGroup.position.set(2.5, 2.5, -4.6);
const tvBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), darkMat); tvBase.position.set(0, 0.025, 0);
const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), darkMat); tvStand.position.set(0, 0.15, 0);
const tvMonitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), darkMat); tvMonitor.position.set(0, 0.7, 0);
const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.02), darkMat); tvScreen.position.set(0, 0.7, 0.05); 
tvGroup.add(tvBase, tvStand, tvMonitor, tvScreen); scene.add(tvGroup);

// ===== OUTSIDE & STARS =====
const outsideGroup = new THREE.Group();
const yard = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x0a1c0a })); 
yard.rotation.x = -Math.PI / 2; yard.position.set(15, -0.1, 20); outsideGroup.add(yard);

// INSTANCED MESH FOR FENCE (Massive draw call reduction)
const fenceGeom = new THREE.BoxGeometry(0.2, 3, 2);
const instancedFence = new THREE.InstancedMesh(fenceGeom, woodMat, 80);
const dummy = new THREE.Object3D();
for(let i=0; i<80; i++) {
    dummy.position.set(15, 1.5, -60 + (i*2));
    dummy.updateMatrix();
    instancedFence.setMatrixAt(i, dummy.matrix);
}
outsideGroup.add(instancedFence);

const starsGeom = new THREE.BufferGeometry();
const starsCount = 400; const starPosArr = new Float32Array(starsCount * 3);
for(let i=0; i < starsCount; i++) {
    const radius = 40 + Math.random() * 2; const theta = Math.random() * Math.PI; const phi = Math.random() * Math.PI * 2; 
    starPosArr[i*3] = radius * Math.sin(theta) * Math.cos(phi); starPosArr[i*3+1] = Math.abs(radius * Math.sin(theta) * Math.sin(phi)) + 5; starPosArr[i*3+2] = radius * Math.cos(theta);
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
outsideGroup.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff })));
scene.add(outsideGroup);


// ===== MINECRAFT BEDROCK PBR LIGHTING =====

// 1. DIRECTIONAL MOONLIGHT (Minecraft uses Sun/Moon for shadows)
const moonLight = new THREE.DirectionalLight(0x224488, 0.4); 
moonLight.position.set(20, 15, 5); 
moonLight.target.position.set(0, 0, 0); 
moonLight.castShadow = true;
// Shadow Camera configuration specifically for the window
moonLight.shadow.camera.left = -15; moonLight.shadow.camera.right = 15;
moonLight.shadow.camera.top = 15; moonLight.shadow.camera.bottom = -15;
moonLight.shadow.mapSize.width = 1024; moonLight.shadow.mapSize.height = 1024;
moonLight.shadow.bias = -0.001;
scene.add(moonLight); 
scene.add(moonLight.target);

// 2. POINT LIGHTS (No Shadows = No Lag. Minecraft Torches don't cast shadows!)
const lampLight = new THREE.PointLight(0xffaa55, 0.8, 12); 
lampLight.position.set(0.4, 3.5, 4.7); 
lampLight.castShadow = false; 
scene.add(lampLight);

const closetLight = new THREE.PointLight(0x444455, 0.5, 5); 
closetLight.position.set(-2.0, 5, -7); 
closetLight.castShadow = false;
scene.add(closetLight);

// 3. FLASHLIGHT (SpotLight is highly optimized)
const flashlight = new THREE.SpotLight(0xfff5e6, 1.2, 40, Math.PI / 5, 0.8, 2);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1); 
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 512;
flashlight.shadow.mapSize.height = 512;
flashlight.shadow.bias = -0.001; 
flashlight.visible = flashlightOn;
camera.add(flashlight);
camera.add(flashlight.target);

// APPLY SHADOWS & CULLING
scene.traverse((child) => {
    // Frustum Culling unloads geometry outside the camera view (Minecraft Chunk style)
    child.frustumCulled = true; 

    if (child.isMesh && child.material !== invisibleMat && child.material !== darkMat && child !== instancedFence) {
        if (child.userData.type === 'window') {
            child.receiveShadow = true; 
        } else { 
            child.castShadow = true; 
            child.receiveShadow = true; 
        }
        
        // UNLOAD STATIC MATH (Saves CPU)
        if (!dynamicColliders.includes(child) && child.userData.type !== 'main door' && child.userData.type !== 'closet door') {
            child.matrixAutoUpdate = false;
            child.updateMatrix();
        }
    }
});

// PRE-COMPUTE COLLISION DATA
const staticColliderBoxes = [];
scene.updateMatrixWorld(true);
staticColliders.forEach(c => staticColliderBoxes.push(new THREE.Box3().setFromObject(c)));

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
const dynamicBox = new THREE.Box3();
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
        
        if (doorOpen && camera.position.distanceTo(mainDoorHinge.position) > 6) { doorOpen = false; mainDoorTargetRot = 0; }
        if (closetDoorOpen && camera.position.distanceTo(closetDoorHinge.position) > 6) { closetDoorOpen = false; closetDoorTargetRot = 0; }

        if (gameTime >= 720) trigger6AM();
        else {
            const hoursPassed = Math.floor(gameTime / 120); const secondsInCurrentHour = gameTime % 120;
            let displayHour = 12 + hoursPassed; if (displayHour > 12) displayHour -= 12;
            const newTimeString = `${displayHour}${secondsInCurrentHour < 60 ? ":00" : ":30"} AM`;
            if (newTimeString !== lastTimeString) { lastTimeString = newTimeString; updateClockDisplay(lastTimeString); }
        }

        // THROTTLED RAYCASTING
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
            for(let i=0; i < staticColliderBoxes.length; i++) { if(playerBox.intersectsBox(staticColliderBoxes[i])) return true; }
            for(let i=0; i < dynamicColliders.length; i++) { dynamicBox.setFromObject(dynamicColliders[i]); if(playerBox.intersectsBox(dynamicBox)) return true; }
            return false;
        };

        camera.position.x = newX; camera.position.z = prevZ; if (checkCollision()) camera.position.x = prevX;
        camera.position.z = newZ; if (checkCollision()) camera.position.z = prevZ; camera.position.y = 3;
        
    } else if (!isPlaying && !gameOver) clock.getDelta(); 

    renderer.render(scene, camera);
}
animate();
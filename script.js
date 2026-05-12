import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/PointerLockControls.js';

// ===== GAME STATE & UI =====
let isPlaying = false, gameOver = false, gameTime = 0, doorOpen = false, closetDoorOpen = false;
let flashlightOn = false, lastTimeString = "", mainDoorTargetRot = 0, closetDoorTargetRot = 0;

const mainMenu = document.getElementById('main-menu'), startBtn = document.getElementById('start-btn');
const gameUi = document.getElementById('game-ui'), interactionText = document.getElementById('interaction-text');
const sixAmScreen = document.getElementById('six-am-screen');

// ===== SCENE & ENGINE =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010101); // Near pitch black
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120); 

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Caps resolution for max FPS
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
camera.position.set(0, 3, 0); scene.add(camera); 

startBtn.addEventListener('click', () => { if (!gameOver) controls.lock(); });
controls.addEventListener('lock', () => { mainMenu.style.display = 'none'; gameUi.style.display = 'block'; isPlaying = true; });
controls.addEventListener('unlock', () => { if(!gameOver) mainMenu.style.display = 'flex'; gameUi.style.display = 'none'; isPlaying = false; move.forward = move.backward = move.left = move.right = false; });
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

const interactables = [], staticColliders = [], dynamicColliders = []; 

// ===== PROCEDURAL PBR TEXTURES =====
function createTexture(type) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ctx = c.getContext('2d');
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

const wallMat = new THREE.MeshStandardMaterial({ map: createTexture('wall'), roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ map: createTexture('wood'), roughness: 0.8 });
const perfectWhiteWoodMat = new THREE.MeshStandardMaterial({ map: createTexture('perfectWhiteWood'), roughness: 0.8 });
const fabricMat = new THREE.MeshStandardMaterial({ map: createTexture('fabric'), roughness: 1.0 });
const metalMat = new THREE.MeshStandardMaterial({ map: createTexture('metal'), roughness: 0.2, metalness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
const trueVoidMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); 

// ===== CLOCK CANVAS =====
const clockCanvas = document.createElement('canvas'); clockCanvas.width = 256; clockCanvas.height = 128; 
const clockCtx = clockCanvas.getContext('2d'); const clockTex = new THREE.CanvasTexture(clockCanvas);
function updateClockDisplay(timeStr) {
    clockCtx.fillStyle = '#050505'; clockCtx.fillRect(0,0,256,128);
    clockCtx.fillStyle = '#ff0000'; clockCtx.font = 'bold 50px Courier New'; 
    clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle';
    clockCtx.fillText(timeStr, 128, 64); clockTex.needsUpdate = true;
}
updateClockDisplay("12:00 AM");

// ===== HELPER: BUILDS WALLS, FLOORS & CEILINGS CLEANLY =====
function makeBox(w, h, d, x, y, z, mat, parent = scene, collides = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (collides) staticColliders.push(mesh);
    return mesh;
}

// Thick Floors & Ceilings (Prevents light leaks)
makeBox(10.5, 1, 10.5, 0, -0.5, 0, woodMat, scene, false); // Bed Floor
makeBox(10.5, 1, 10.5, 0, 6.5, 0, wallMat, scene, false);  // Bed Ceil
makeBox(4.5, 1, 37, -7.5, -0.5, 11.5, woodMat, scene, false); // Hall Floor
makeBox(4.5, 1, 37, -7.5, 6.5, 11.5, wallMat, scene, false);  // Hall Ceil
makeBox(3.5, 1, 3.5, -2.0, -0.5, -7, woodMat, scene, false);  // Closet Floor
makeBox(3.5, 1, 3.5, -2.0, 6.5, -7, wallMat, scene, false);   // Closet Ceil
makeBox(50, 4, 50, 0, 8.5, 0, darkMat, scene, false); // Giant Roof (Blocks all upward light leaks)

// Bedroom Walls
makeBox(10.5, 6, 0.5, 0, 3, 5.25, wallMat); // South
makeBox(0.5, 2, 3, 5.25, 1, 0, wallMat); // East Bottom
makeBox(0.5, 2, 3, 5.25, 5, 0, wallMat); // East Top
makeBox(0.5, 6, 3.75, 5.25, 3, -3.375, wallMat); // East Left
makeBox(0.5, 6, 3.75, 5.25, 3, 3.375, wallMat); // East Right
makeBox(0.5, 1.8, 3.4, -5.25, 5.1, 0, wallMat); // West Top
makeBox(0.5, 6, 3.55, -5.25, 3, -3.475, wallMat); // West Left
makeBox(0.5, 6, 3.55, -5.25, 3, 3.475, wallMat); // West Right
makeBox(1.55, 6, 0.5, -4.475, 3, -5.25, wallMat); // North Left
makeBox(5.55, 6, 0.5, 2.475, 3, -5.25, wallMat); // North Right
makeBox(3.5, 1.8, 0.5, -2.0, 5.1, -5.25, wallMat); // North Top

// Window Glass
const win = makeBox(0.2, 2, 3, 5.25, 3, 0, new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
win.userData = { type: 'window' }; interactables.push(win);

// Hallway Walls (Z-Fighting fully eliminated)
makeBox(0.5, 6, 2, -5.25, 3, -6, wallMat); // East North
makeBox(0.5, 6, 9.3, -5.25, 3, 9.65, wallMat); // East Seg1
makeBox(0.5, 6, 12.3, -5.25, 3, 23.85, wallMat); // East Seg2
makeBox(0.5, 1.8, 3.4, -5.25, 5.1, 16, wallMat); // East Top
makeBox(0.5, 6, 13.3, -9.75, 3, -0.35, wallMat); // West Seg1
makeBox(0.5, 6, 10.3, -9.75, 3, 14.85, wallMat); // West Seg2
makeBox(0.5, 6, 6, -9.75, 3, 27, wallMat); // West Seg3
makeBox(0.5, 1.8, 3.4, -9.75, 5.1, 8, wallMat); // West Top1
makeBox(0.5, 1, 4, -9.75, 5.5, 22, wallMat); // West Top2
makeBox(5, 6, 0.5, -7.5, 3, 30, wallMat); // South Cap
makeBox(5, 6, 0.5, -7.5, 3, -7, wallMat); // North Cap

// Living Room Void
makeBox(0.1, 5, 4, -9.75, 2.5, 22, invisibleMat, scene, false); 
makeBox(2, 6, 4.5, -11, 3, 22, trueVoidMat, scene, false); 
makeBox(4, 10, 0.5, -7.5, 5, 1.5, invisibleMat); // Hall safety barrier

// Closet Interior
makeBox(3, 6, 0.5, -2.0, 3, -8.75, wallMat); // Back
makeBox(0.5, 6, 3.0, -3.75, 3, -7, wallMat); // Left
makeBox(0.5, 6, 3.0, -0.25, 3, -7, wallMat); // Right
makeBox(3.4, 0.1, 1.5, -2.0, 5.0, -8.0, woodMat, scene, false); // Shelf
const cRod = makeBox(0.03, 3.4, 0.03, -2.0, 4.7, -7.5, metalMat, scene, false); cRod.rotation.z = Math.PI/2;

// Frames Factory
const buildFrame = (x, y, z, rotY) => {
    const f = new THREE.Group();
    makeBox(0.6, 0.2, 3.4, 0, 2.1, 0, perfectWhiteWoodMat, f, false);
    makeBox(0.6, 4, 0.2, 0, 0, -1.6, perfectWhiteWoodMat, f, false);
    makeBox(0.6, 4, 0.2, 0, 0, 1.6, perfectWhiteWoodMat, f, false);
    f.position.set(x, y, z); f.rotation.y = rotY; scene.add(f);
}
buildFrame(-5.25, 2, 0, 0); buildFrame(-2.0, 2, -5.25, Math.PI/2); 
buildFrame(-9.75, 2, 8, 0); buildFrame(-5.25, 2, 16, 0); 

// ===== DOORS (DYNAMIC COLLIDERS) =====
const buildDoor = (isCloset, hingeX, hingeZ, edgeX, edgeZ, kx, kz, rotY, type) => {
    const hinge = new THREE.Group(); hinge.position.set(hingeX, 2, hingeZ); scene.add(hinge);
    const d = makeBox(isCloset?2.9:0.2, 4, isCloset?0.2:2.9, edgeX, 0, edgeZ, isCloset?perfectWhiteWoodMat:woodMat, hinge, false);
    const k1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k1.position.set(kx, 0, kz); k1.userData.noShadow = true;
    const k2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k2.position.set(isCloset?kx:-kx, 0, isCloset?-kz:kz); k2.userData.noShadow = true;
    d.add(k1, k2); d.userData = { type: type };
    interactables.push(d); dynamicColliders.push(d);
    return hinge;
};
const mainDoorHinge = buildDoor(false, -5.25, -1.5, 0, 1.45, 0.15, 1.15, 0, 'main door');
const closetDoorHinge = buildDoor(true, -3.5, -5.25, 1.45, 0, 1.15, 0.15, 0, 'closet door');
const fDoor1 = buildDoor(false, -9.75, 6.5, 0, 1.45, 0.15, 1.15, 0, 'fake door'); interactables.pop(); // Remove interactable
const fDoor2 = buildDoor(false, -5.25, 14.5, 0, 1.45, 0.15, 1.15, 0, 'fake door'); interactables.pop(); // Remove interactable

// Hanging Clothes
const clothesData = [
    { t: 's', c: 0x882222 }, { t: 'p', c: 0x224488 }, { t: 's', c: 0x228822 }, 
    { t: 'p', c: 0x111111 }, { t: 's', c: 0xdddddd }, { t: 'p', c: 0x886644 },
    { t: 's', c: 0x222288 }, { t: 'p', c: 0x333333 }, { t: 's', c: 0x552255 }
];
for(let i=0; i<9; i++) {
    const grp = new THREE.Group(); grp.position.set(-3.4 + (i*0.35), 4.7, -7.5); grp.rotation.y = (Math.random()-0.5)*0.15; 
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 16, Math.PI), metalMat); hook.position.y = -0.05; hook.rotation.z = Math.PI; hook.rotation.y = Math.PI/2;
    const base = makeBox(0.02, 0.02, 0.4, 0, -0.15, 0, metalMat, grp, false); base.userData.noShadow = true; hook.userData.noShadow = true;
    makeBox(0.12, clothesData[i].t === 's' ? 1.0 : 0.8, clothesData[i].t === 's' ? 0.45 : 0.35, 0, clothesData[i].t === 's' ? -0.65 : -0.55, 0, new THREE.MeshStandardMaterial({color: clothesData[i].c, roughness: 0.9}), grp, false);
    grp.add(hook); scene.add(grp);
}

// ===== FURNITURE =====
// Bed
const bed = new THREE.Group(); scene.add(bed);
makeBox(3.0, 2.0, 0.2, 3.5, 1.0, 4.9, woodMat, bed, false); // Headboard
makeBox(3.0, 1.0, 0.2, 3.5, 0.5, 0.1, woodMat, bed, false); // Footboard
makeBox(0.2, 0.6, 4.6, 4.9, 0.5, 2.5, woodMat, bed, false); // Right Rail
makeBox(0.2, 0.6, 4.6, 2.1, 0.5, 2.5, woodMat, bed, false); // Left Rail
makeBox(2.6, 0.5, 4.6, 3.5, 0.65, 2.5, fabricMat, bed, false); // Mattress
[ [2.2, 0.2, 4.8], [4.8, 0.2, 4.8], [2.2, 0.2, 0.2], [4.8, 0.2, 0.2] ].forEach(p => { 
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.4), woodMat); leg.position.set(...p); bed.add(leg); 
});
const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffffff })); 
pillow.scale.set(1.1, 0.2, 0.4); pillow.position.set(3.5, 0.95, 4.2); bed.add(pillow);
makeBox(3.0, 2.0, 5.0, 3.5, 1.0, 2.5, invisibleMat, scene, true); // Bed Collider

// Dressers 
const buildDresser = (x, y, z, isTV) => {
    const dG = new THREE.Group(); dG.position.set(x, y, z); scene.add(dG);
    makeBox(2, 2.5, 1, 0, 0, 0, woodMat, dG, true);
    for(let i=0; i<3; i++) {
        const drw = makeBox(1.8, 0.7, 0.1, 0, 0.7 - (i*0.8), isTV ? 0.55 : -0.55, woodMat, dG, false);
        const knb = new THREE.Mesh(new THREE.SphereGeometry(0.06), metalMat); knb.position.set(0, 0, isTV ? 0.05 : -0.05); knb.userData.noShadow = true; drw.add(knb);
    }
}
buildDresser(1, 1.25, 4.5, false); // South Dresser
buildDresser(2.5, 1.25, -4.5, true); // North Dresser

// Lamp & Clock (South Dresser)
const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), metalMat); lBase.position.set(0.4, 2.75, 4.7); scene.add(lBase);
const lShade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffee, roughness: 0.8 })); lShade.position.set(0.4, 3.2, 4.7); scene.add(lShade);

const clock = new THREE.Group(); clock.position.set(1.6, 2.6, 4.5); clock.rotation.y = -0.15; scene.add(clock);
makeBox(0.7, 0.4, 0.4, 0, 0, 0, darkMat, clock, false);
const cFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.32, 0.05), [darkMat, darkMat, darkMat, darkMat, darkMat, new THREE.MeshBasicMaterial({map: clockTex})]);
cFace.position.set(0, 0.05, -0.22); cFace.rotation.x = 0.3; clock.add(cFace);
makeBox(0.3, 0.04, 0.15, 0, 0.2, 0, metalMat, clock, false);

// TV (North Dresser)
const tvGroup = new THREE.Group(); tvGroup.position.set(2.5, 2.5, -4.6); scene.add(tvGroup);
makeBox(0.8, 0.05, 0.4, 0, 0.025, 0, darkMat, tvGroup, false);
const tvStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), darkMat); tvStand.position.set(0, 0.15, 0); tvGroup.add(tvStand);
makeBox(1.6, 1.0, 0.1, 0, 0.7, 0, darkMat, tvGroup, false);
makeBox(1.5, 0.9, 0.02, 0, 0.7, 0.05, new THREE.MeshStandardMaterial({color: 0x050508}), tvGroup, false);

// ===== OUTSIDE & STARS =====
makeBox(100, 0.1, 100, 15, -0.1, 20, new THREE.MeshStandardMaterial({ color: 0x0a1c0a }), scene, false); // Yard
for(let i=0; i<80; i++) { makeBox(0.2, 3, 2, 15, 1.5, -60 + (i*2), woodMat, scene, false); } // Long Fence

const starsGeom = new THREE.BufferGeometry(); const starPosArr = new Float32Array(400 * 3);
for(let i=0; i < 400; i++) {
    const r = 40 + Math.random() * 2; const t = Math.random() * Math.PI; const p = Math.random() * Math.PI * 2; 
    starPosArr[i*3] = r * Math.sin(t) * Math.cos(p); starPosArr[i*3+1] = Math.abs(r * Math.sin(t) * Math.sin(p)) + 5; starPosArr[i*3+2] = r * Math.cos(t);
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
scene.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff })));

// ===== LIGHTING & SHADOWS =====
const moonLight = new THREE.DirectionalLight(0x224488, 0.3); moonLight.position.set(20, 20, -5); moonLight.target.position.set(0, 0, 0); 
moonLight.castShadow = true; moonLight.shadow.camera.left = -40; moonLight.shadow.camera.right = 40; moonLight.shadow.camera.top = 40; moonLight.shadow.camera.bottom = -40;
moonLight.shadow.mapSize.width = 1024; moonLight.shadow.mapSize.height = 1024; moonLight.shadow.bias = -0.002; moonLight.shadow.normalBias = 0.05;
scene.add(moonLight); scene.add(moonLight.target);

const lampLight = new THREE.PointLight(0xffaa55, 0.8, 7.0); lampLight.position.set(0.4, 3.5, 4.7); 
lampLight.castShadow = true; lampLight.shadow.mapSize.width = 512; lampLight.shadow.mapSize.height = 512; lampLight.shadow.bias = -0.001; lampLight.shadow.normalBias = 0.05; 
scene.add(lampLight);

const closetLight = new THREE.PointLight(0x444455, 0.5, 4.0); closetLight.position.set(-2.0, 5, -7); scene.add(closetLight);

const flashlight = new THREE.SpotLight(0xfff5e6, 1.5, 40, Math.PI / 6, 0.5, 2); flashlight.position.set(0, 0, 0); flashlight.target.position.set(0, 0, -1); 
flashlight.castShadow = true; flashlight.shadow.mapSize.width = 1024; flashlight.shadow.mapSize.height = 1024; flashlight.shadow.bias = -0.0005; flashlight.shadow.normalBias = 0.02; flashlight.visible = flashlightOn;
camera.add(flashlight); camera.add(flashlight.target);

scene.traverse((child) => {
    if (child.isMesh && child.material !== invisibleMat && child.material !== darkMat && child.material !== trueVoidMat) {
        if (child.userData.type === 'window') { child.receiveShadow = true; } 
        else { child.castShadow = true; child.receiveShadow = true; }
    }
});

// ===== PRE-COMPUTE COLLISION BOXES =====
const staticColliderBoxes = [];
scene.updateMatrixWorld(true);
staticColliders.forEach(c => staticColliderBoxes.push(new THREE.Box3().setFromObject(c)));

// ===== INTERACTION LOGIC =====
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(0, 0); 
document.addEventListener('mousedown', (e) => {
    if (!isPlaying || gameOver) return;
    if (e.button === 2) { flashlightOn = !flashlightOn; flashlight.visible = flashlightOn; return; }
    if (e.button !== 0) return; 
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length > 0 && intersects[0].distance < 4) {
        const object = intersects[0].object;
        if (object.userData.type === 'main door') { doorOpen = !doorOpen; mainDoorTargetRot = doorOpen ? -Math.PI / 2 : 0; interactionText.innerText = doorOpen ? "*Door Opened*" : "*Door Closed*"; }
        if (object.userData.type === 'closet door') { closetDoorOpen = !closetDoorOpen; closetDoorTargetRot = closetDoorOpen ? -Math.PI / 2 : 0; interactionText.innerText = closetDoorOpen ? "*Closet Opened*" : "*Closet Closed*"; }
        if (object.userData.type === 'window') interactionText.innerText = "It's pitch black out there...";
        setTimeout(() => interactionText.innerText = "", 2000);
    }
});
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// ===== GAME LOOP =====
const clock = new THREE.Clock(); const moveSpeed = 6.0;
const playerBox = new THREE.Box3(); const dynamicBox = new THREE.Box3();
const pSize = new THREE.Vector3(0.8, 3, 0.8); const pCenter = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying && !gameOver) {
        const delta = clock.getDelta(); gameTime += delta; frameCount++;

        mainDoorHinge.rotation.y = THREE.MathUtils.lerp(mainDoorHinge.rotation.y, mainDoorTargetRot, delta * 5);
        closetDoorHinge.rotation.y = THREE.MathUtils.lerp(closetDoorHinge.rotation.y, closetDoorTargetRot, delta * 5);
        
        if (doorOpen && camera.position.distanceTo(mainDoorHinge.position) > 6) { doorOpen = false; mainDoorTargetRot = 0; }
        if (closetDoorOpen && camera.position.distanceTo(closetDoorHinge.position) > 6) { closetDoorOpen = false; closetDoorTargetRot = 0; }

        if (gameTime >= 720) {
            gameOver = true; isPlaying = false; controls.unlock(); updateClockDisplay("6:00 AM");
            gameUi.style.display = 'none'; mainMenu.style.display = 'none'; sixAmScreen.style.display = 'flex';
            setTimeout(() => { sixAmScreen.style.opacity = '1'; setTimeout(() => { sixAmScreen.innerText = "6:00 AM"; }, 1500); }, 100);
        } else {
            const h = Math.floor(gameTime / 120); const s = gameTime % 120;
            let dH = 12 + h; if (dH > 12) dH -= 12;
            const tStr = `${dH}${s < 60 ? ":00" : ":30"} AM`;
            if (tStr !== lastTimeString) { lastTimeString = tStr; updateClockDisplay(lastTimeString); }
        }

        if (frameCount % 4 === 0) {
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(interactables);
            if (hits.length > 0 && hits[0].distance < 4) {
                if(interactionText.innerText === "") interactionText.innerText = `Click to interact with ${hits[0].object.userData.type}`;
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
// --- END OF FILE ---
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
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
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

const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat); sWall.position.set(0, 3, 5.25); scene.add(sWall); colliders.push(sWall);
const eWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallBottom.position.set(5.25, 1, 0);
const eWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eWallTop.position.set(5.25, 5, 0);
const eWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallLeft.position.set(5.25, 3, -3.25);
const eWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eWallRight.position.set(5.25, 3, 3.25);
scene.add(eWallBottom, eWallTop, eWallLeft, eWallRight); colliders.push(eWallBottom, eWallLeft, eWallRight);

const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
windowGlass.position.set(5.25, 3, 0); windowGlass.userData = { type: 'window' }; scene.add(windowGlass); interactables.push(windowGlass); colliders.push(windowGlass);

const wWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); wWallTop.position.set(-5.25, 5.1, 0);
const wWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallLeft.position.set(-5.25, 3, -3.35);
const wWallRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wWallRight.position.set(-5.25, 3, 3.35);
scene.add(wWallTop, wWallLeft, wWallRight); colliders.push(wWallLeft, wWallRight);

const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 0.5), wallMat); nWallLeft.position.set(-4.5, 3, -5.25);
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6, 0.5), wallMat); nWallRight.position.set(2.5, 3, -5.25);
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.5), wallMat); nWallTop.position.set(-2.0, 5.1, -5.25);
scene.add(nWallLeft, nWallRight, nWallTop); colliders.push(nWallLeft, nWallRight);

const buildFrame = (x, y, z, rotY) => {
    const frame = new THREE.Group();
    const tFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 3.4), perfectWhiteWoodMat); tFrame.position.set(0, 2.1, 0);
    const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); lFrame.position.set(0, 0, -1.6);
    const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), perfectWhiteWoodMat); rFrame.position.set(0, 0, 1.6);
    frame.add(tFrame, lFrame, rFrame); frame.position.set(x, y, z); frame.rotation.y = rotY; scene.add(frame);
}
buildFrame(-5.25, 2, 0, 0); buildFrame(-2.0, 2, -5.25, Math.PI/2); 

// ===== DOORS =====
const mainDoorHinge = new THREE.Group(); mainDoorHinge.position.set(-5.25, 2, -1.5); scene.add(mainDoorHinge);
const mainDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat);
const mKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob1.position.set(0.15, 0, 1.2);
const mKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); mKnob2.position.set(-0.15, 0, 1.2);
mainDoorMesh.add(mKnob1, mKnob2); mainDoorMesh.position.set(0, 0, 1.5); mainDoorMesh.userData = { type: 'main door' };
mainDoorHinge.add(mainDoorMesh); interactables.push(mainDoorMesh); colliders.push(mainDoorMesh);

const closetDoorHinge = new THREE.Group(); closetDoorHinge.position.set(-3.5, 2, -5.25); scene.add(closetDoorHinge);
const closetDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), perfectWhiteWoodMat);
const cKnob1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob1.position.set(1.2, 0, 0.15);
const cKnob2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); cKnob2.position.set(1.2, 0, -0.15);
closetDoorMesh.add(cKnob1, cKnob2); closetDoorMesh.position.set(1.5, 0, 0); closetDoorMesh.userData = { type: 'closet door' };
closetDoorHinge.add(closetDoorMesh); interactables.push(closetDoorMesh); colliders.push(closetDoorMesh);

// ===== HALLWAY =====
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(4, 21), woodMat); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(-7.5, 0.01, 7.5); scene.add(hallFloor);
const hallWallWest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 21), wallMat); hallWallWest.position.set(-9.75, 3, 7.5); scene.add(hallWallWest); colliders.push(hallWallWest);
const hallWallEast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 13), wallMat); hallWallEast.position.set(-5.25, 3, 11.5); scene.add(hallWallEast); colliders.push(hallWallEast);
const hallBarrier = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.5), invisibleMat); hallBarrier.position.set(-7.5, 5, 1.5); scene.add(hallBarrier); colliders.push(hallBarrier);
// Fake Doors
const fDoor1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 2), woodMat); fDoor1.position.set(-9.5, 2, 4); scene.add(fDoor1);
const fDoor2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 2), woodMat); fDoor2.position.set(-9.5, 2, 10); scene.add(fDoor2);

// ===== CLOSET INTERIOR =====
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat); cBack.position.set(-2.0, 3, -8.75); scene.add(cBack); colliders.push(cBack);
const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.5), woodMat); shelf.position.set(-2.0, 5.0, -8.0); scene.add(shelf);
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4), metalMat); rod.rotation.z = Math.PI / 2; rod.position.set(-2.0, 4.7, -7.5); scene.add(rod);
const clothesData = [{t:'shirt',c:0x882222},{t:'pants',c:0x224488},{t:'shirt',c:0x228822}];
clothesData.forEach((d,i) => {
    const item = new THREE.Group(); item.position.set(-3.0 + (i*0.6), 4.7, -7.5);
    const clothing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.45), new THREE.MeshStandardMaterial({color:d.c}));
    clothing.position.y = -0.65; item.add(clothing); scene.add(item);
});

// ===== FURNITURE =====
const bedGroup = new THREE.Group();
const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.6), fabricMat); mattress.position.set(3.5, 0.65, 2.5); bedGroup.add(mattress);
const bedHead = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.2), woodMat); bedHead.position.set(3.5, 1, 4.9); bedGroup.add(bedHead);
const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffffff })); pillow.scale.set(1.1, 0.2, 0.4); pillow.position.set(3.5, 0.95, 4.2); bedGroup.add(pillow);
scene.add(bedGroup); 
const bedCol = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 5), invisibleMat); bedCol.position.set(3.5, 1, 2.5); scene.add(bedCol); colliders.push(bedCol);

const d1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); d1.position.set(1, 1.25, 4.5); scene.add(d1); colliders.push(d1);
const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), metalMat); lamp.position.set(0.4, 2.75, 4.7); scene.add(lamp);

const clockGroup = new THREE.Group(); clockGroup.position.set(1.6, 2.6, 4.5); 
const clockBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), new THREE.MeshStandardMaterial({color: 0x1a1a1a}));
const screenFace = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.32, 0.05), [darkMat, darkMat, darkMat, darkMat, darkMat, new THREE.MeshBasicMaterial({map: clockTex})]);
screenFace.position.set(0, 0.05, -0.22); screenFace.rotation.x = 0.3; clockGroup.add(clockBase, screenFace); scene.add(clockGroup);

const d2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); d2.position.set(2.5, 1.25, -4.5); scene.add(d2); colliders.push(d2);
const tv = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), darkMat); tv.position.set(2.5, 3.2, -4.6); scene.add(tv);

// ===== OUTSIDE =====
const yard = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x0a1c0a })); yard.rotation.x = -Math.PI/2; yard.position.set(15, -0.1, 20); scene.add(yard);
const starsGeom = new THREE.BufferGeometry(); const starPos = new Float32Array(600 * 3);
for(let i=0; i < 600; i++) {
    const r = 80; const theta = Math.random() * Math.PI; const phi = Math.random() * Math.PI * 2; 
    starPos[i*3] = r * Math.sin(theta) * Math.cos(phi); starPos[i*3+1] = Math.abs(r * Math.sin(theta) * Math.sin(phi)) + 5; starPos[i*3+2] = r * Math.cos(theta);
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.2, color: 0xffffff })));

// Lighting
scene.add(new THREE.AmbientLight(0x333333));
const l1 = new THREE.PointLight(0xffaa55, 0.8, 15); l1.position.set(0.4, 3.5, 4.7); scene.add(l1);
const l2 = new THREE.PointLight(0x444455, 0.6, 20); l2.position.set(-7.5, 5, 8); scene.add(l2);

// Interactions
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(0, 0); 
document.addEventListener('mousedown', () => {
    if (!isPlaying || gameOver) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length > 0 && intersects[0].distance < 4) {
        const obj = intersects[0].object;
        if (obj.userData.type === 'main door') { doorOpen = !doorOpen; mainDoorTargetRot = doorOpen ? -Math.PI / 2 : 0; }
        if (obj.userData.type === 'closet door') { closetDoorOpen = !closetDoorOpen; closetDoorTargetRot = closetDoorOpen ? -Math.PI / 2 : 0; }
    }
});

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    if (isPlaying && !gameOver) {
        const delta = clock.getDelta(); gameTime += delta;
        mainDoorHinge.rotation.y = THREE.MathUtils.lerp(mainDoorHinge.rotation.y, mainDoorTargetRot, delta * 5);
        closetDoorHinge.rotation.y = THREE.MathUtils.lerp(closetDoorHinge.rotation.y, closetDoorTargetRot, delta * 5);

        // Auto-close proximity
        if (doorOpen && camera.position.distanceTo(mainDoorHinge.position) > 6) { doorOpen = false; mainDoorTargetRot = 0; }
        if (closetDoorOpen && camera.position.distanceTo(closetDoorHinge.position) > 6) { closetDoorOpen = false; closetDoorTargetRot = 0; }

        if (gameTime >= 720) {
            gameOver = true; isPlaying = false; controls.unlock(); updateClockDisplay("6:00 AM");
            gameUi.style.display = 'none'; sixAmScreen.style.display = 'flex';
            setTimeout(() => { sixAmScreen.style.opacity = '1'; setTimeout(() => { sixAmScreen.innerText = "6:00 AM"; }, 1500); }, 100);
        } else {
            const hrs = Math.floor(gameTime / 120); const secs = gameTime % 120;
            let dHr = 12 + hrs; if (dHr > 12) dHr -= 12;
            const ts = `${dHr}${secs < 60 ? ":00" : ":30"} AM`;
            if (ts !== lastTimeString) { lastTimeString = ts; updateClockDisplay(ts); }
        }

        // Logic
        let dirZ = Number(move.forward) - Number(move.backward);
        let dirX = Number(move.right) - Number(move.left);
        if(dirX !== 0 && dirZ !== 0) { const len = Math.sqrt(dirX*dirX+dirZ*dirZ); dirX /= len; dirZ /= len; }
        const pX = camera.position.x; const pZ = camera.position.z;
        controls.moveForward(dirZ * 6.0 * delta); controls.moveRight(dirX * 6.0 * delta);
        const playerBox = new THREE.Box3();
        const check = () => {
            playerBox.setFromCenterAndSize(new THREE.Vector3(camera.position.x, 1.5, camera.position.z), new THREE.Vector3(0.8, 3, 0.8));
            for(let c of colliders) { if(playerBox.intersectsBox(new THREE.Box3().setFromObject(c))) return true; }
            return false;
        };
        const nX = camera.position.x; const nZ = camera.position.z;
        camera.position.x = nX; camera.position.z = pZ; if (check()) camera.position.x = pX;
        camera.position.z = nZ; if (check()) camera.position.z = pZ;
        camera.position.y = 3;
    } else { clock.getDelta(); }
    renderer.render(scene, camera);
}
animate();
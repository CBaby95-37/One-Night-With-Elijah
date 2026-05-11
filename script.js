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

// ===== TEXTURE GENERATOR =====
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
        const grd = ctx.createLinearGradient(0,0,512,512); grd.addColorStop(0, "#888"); grd.addColorStop(0.5, "#eee"); grd.addColorStop(1, "#555");
        ctx.fillStyle = grd; ctx.fillRect(0,0,512,512);
    } else if (type === 'perfectWhiteWood') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<300; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.03})`; ctx.fillRect(Math.random()*512, 0, Math.random()*4+1, 512); }
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

const wallMat = new THREE.MeshStandardMaterial({ map: createTexture('wall') });
const woodMat = new THREE.MeshStandardMaterial({ map: createTexture('wood') });
const whiteWoodMat = new THREE.MeshStandardMaterial({ map: createTexture('perfectWhiteWood') });
const fabricMat = new THREE.MeshStandardMaterial({ map: createTexture('fabric') });
const metalMat = new THREE.MeshStandardMaterial({ map: createTexture('metal'), roughness: 0.2, metalness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

// ===== ALARM CLOCK CANVAS =====
const clockCanvas = document.createElement('canvas'); clockCanvas.width = 256; clockCanvas.height = 128;
const clockCtx = clockCanvas.getContext('2d'); const clockTex = new THREE.CanvasTexture(clockCanvas);
function updateClockDisplay(timeStr) {
    clockCtx.fillStyle = '#050505'; clockCtx.fillRect(0,0,256,128);
    clockCtx.fillStyle = '#ff0000'; clockCtx.font = 'bold 50px Courier New'; 
    clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle';
    clockCtx.fillText(timeStr, 128, 64); clockTex.needsUpdate = true;
}
updateClockDisplay("12:00 AM");

// ===== ENVIRONMENT BUILD =====
// Floors and Ceiling
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), woodMat); floor.rotation.x = -Math.PI/2; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), wallMat); ceil.rotation.x = Math.PI/2; ceil.position.y = 6; scene.add(ceil);

// Walls
const sWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5), wallMat); sWall.position.set(0, 3, 5.25); scene.add(sWall); colliders.push(sWall);
const nWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 0.5), wallMat); nWallLeft.position.set(-4.5, 3, -5.25); scene.add(nWallLeft); colliders.push(nWallLeft);
const nWallRight = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6, 0.5), wallMat); nWallRight.position.set(2.5, 3, -5.25); scene.add(nWallRight); colliders.push(nWallRight);
const nWallTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.5), wallMat); nWallTop.position.set(-2, 5.1, -5.25); scene.add(nWallTop);
const eWall = new THREE.Group();
const eW1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eW1.position.set(5.25, 3, -3.25);
const eW2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.5), wallMat); eW2.position.set(5.25, 3, 3.25);
const eW3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eW3.position.set(5.25, 1, 0);
const eW4 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), wallMat); eW4.position.set(5.25, 5, 0);
eWall.add(eW1, eW2, eW3, eW4); scene.add(eWall); colliders.push(eW1, eW2, eW3);
const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
winGlass.position.set(5.25, 3, 0); winGlass.userData = {type:'window'}; scene.add(winGlass); interactables.push(winGlass); colliders.push(winGlass);

// West Wall (Bedroom Door)
const wW1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wW1.position.set(-5.25, 3, -3.35);
const wW2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 3.3), wallMat); wW2.position.set(-5.25, 3, 3.35);
const wW3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 3.4), wallMat); wW3.position.set(-5.25, 5.1, 0);
scene.add(wW1, wW2, wW3); colliders.push(wW1, wW2);

// Frames
const buildFrame = (x, y, z, rotY) => {
    const f = new THREE.Group();
    const tf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 3.4), whiteWoodMat); tf.position.y = 2.1;
    const lf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), whiteWoodMat); lf.position.z = -1.6;
    const rf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.2), whiteWoodMat); rf.position.z = 1.6;
    f.add(tf, lf, rf); f.position.set(x, y, z); f.rotation.y = rotY; scene.add(f);
}
buildFrame(-5.25, 2, 0, 0); buildFrame(-2, 2, -5.25, Math.PI/2);

// ===== DOORS & HINGES =====
const mainHinge = new THREE.Group(); mainHinge.position.set(-5.25, 2, -1.5); scene.add(mainHinge);
const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 3), woodMat); mainDoor.position.z = 1.5; mainDoor.userData={type:'main door'};
const k1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k1.position.set(0.15,0,1.2);
const k2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k2.position.set(-0.15,0,1.2);
mainDoor.add(k1,k2); mainHinge.add(mainDoor); interactables.push(mainDoor); colliders.push(mainDoor);

const closetHinge = new THREE.Group(); closetHinge.position.set(-3.5, 2, -5.25); scene.add(closetHinge);
const closetDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), whiteWoodMat); closetDoor.position.x = 1.5; closetDoor.userData={type:'closet door'};
const k3 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k3.position.set(1.2,0,0.15);
const k4 = new THREE.Mesh(new THREE.SphereGeometry(0.08), metalMat); k4.position.set(1.2,0,-0.15);
closetDoor.add(k3,k4); closetHinge.add(closetDoor); interactables.push(closetDoor); colliders.push(closetDoor);

// ===== EXTENDED HALLWAY =====
const hallFl = new THREE.Mesh(new THREE.PlaneGeometry(4, 25), woodMat); hallFl.rotation.x = -Math.PI/2; hallFl.position.set(-7.5, 0.01, 7.5); scene.add(hallFl);
const hallCe = new THREE.Mesh(new THREE.PlaneGeometry(4, 25), wallMat); hallCe.rotation.x = Math.PI/2; hallCe.position.set(-7.5, 5.99, 7.5); scene.add(hallCe);
const hallW1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 25), wallMat); hallW1.position.set(-9.75, 3, 7.5); scene.add(hallW1); colliders.push(hallW1);
const hallW2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 15), wallMat); hallW2.position.set(-5.25, 3, 12.5); scene.add(hallW2); colliders.push(hallW2);
const hallBar = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.5), invisibleMat); hallBar.position.set(-7.5, 5, 1.5); scene.add(hallBar); colliders.push(hallBar);

// ===== CLOSET INTERIOR =====
const cBack = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), wallMat); cBack.position.set(-2, 3, -8.75); scene.add(cBack); colliders.push(cBack);
const cShelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.5), woodMat); cShelf.position.set(-2, 5, -8); scene.add(cShelf);
const cRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4), metalMat); cRod.rotation.z = Math.PI/2; cRod.position.set(-2, 4.7, -7.5); scene.add(cRod);
const cData = [{t:'s',c:0x882222},{t:'p',c:0x224488},{t:'s',c:0x228822},{t:'p',c:0x111111},{t:'s',c:0xdddddd}];
cData.forEach((d,i) => {
    const g = new THREE.Group(); g.position.set(-3.2 + (i*0.6), 4.7, -7.5); g.rotation.y = (Math.random()-0.5)*0.2;
    const clothing = new THREE.Mesh(new THREE.BoxGeometry(0.1, (d.t==='s'?1:0.8), (d.t==='s'?0.5:0.4)), new THREE.MeshStandardMaterial({color:d.c}));
    clothing.position.y = (d.t==='s'?-0.6:-0.5); g.add(clothing); scene.add(g);
});

// ===== FURNITURE =====
// Bed
const bed = new THREE.Group();
const matt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 4.6), fabricMat); matt.position.set(3.5, 0.7, 2.5); bed.add(matt);
const head = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.2), woodMat); head.position.set(3.5, 1, 4.9); bed.add(head);
const pil = new THREE.Mesh(new THREE.SphereGeometry(1,32,16), new THREE.MeshStandardMaterial({color:0xffffff})); pil.scale.set(1.1, 0.2, 0.4); pil.position.set(3.5, 1, 4.2); bed.add(pil);
scene.add(bed); const bCol = new THREE.Mesh(new THREE.BoxGeometry(3,2,5), invisibleMat); bCol.position.set(3.5,1,2.5); scene.add(bCol); colliders.push(bCol);

// Dresser 1 (South)
const d1 = new THREE.Group(); d1.position.set(1, 1.25, 4.5);
const d1b = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); d1.add(d1b);
for(let i=0; i<3; i++) {
    const drw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drw.position.set(0, 0.7-(i*0.8), -0.55);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.06), metalMat); kn.position.z=-0.05; drw.add(kn); d1.add(drw);
}
scene.add(d1); colliders.push(d1b);
const lamp = new THREE.Group(); lamp.position.set(0.4, 2.5, 4.7);
const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5), metalMat); lb.position.y=0.25;
const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshStandardMaterial({color:0xffffee})); ls.position.y=0.7; lamp.add(lb,ls); scene.add(lamp);

// Alarm Clock
const clockG = new THREE.Group(); clockG.position.set(1.6, 2.6, 4.5);
const cb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), darkMat); 
const cf = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.3, 0.05), [darkMat, darkMat, darkMat, darkMat, darkMat, new THREE.MeshBasicMaterial({map:clockTex})]);
cf.position.set(0, 0.05, -0.22); cf.rotation.x = 0.3; clockG.add(cb, cf); scene.add(clockG);

// Dresser 2 (North)
const d2 = new THREE.Group(); d2.position.set(2.5, 1.25, -4.5);
const d2b = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1), woodMat); d2.add(d2b);
for(let i=0; i<3; i++) {
    const drw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), woodMat); drw.position.set(0, 0.7-(i*0.8), 0.55);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.06), metalMat); kn.position.z=0.05; drw.add(kn); d2.add(drw);
}
scene.add(d2); colliders.push(d2b);
const tv = new THREE.Group(); tv.position.set(2.5, 2.5, -4.6);
const tvm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), darkMat); tvm.position.y=0.7;
const tvs = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.02), new THREE.MeshStandardMaterial({color:0x050508})); tvs.position.set(0, 0.7, 0.05); tv.add(tvm, tvs); scene.add(tv);

// ===== WORLD & STARS =====
const yard = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x0a1c0a })); yard.rotation.x = -Math.PI/2; yard.position.set(15, -0.1, 20); scene.add(yard);
for(let i=0; i<30; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2), woodMat); f.position.set(15, 1.5, -10 + (i*2)); scene.add(f);
}
const sGeo = new THREE.BufferGeometry(); const sPos = new Float32Array(600 * 3);
for(let i=0; i < 600; i++) {
    const r = 80; const theta = Math.random()*Math.PI; const phi = Math.random()*Math.PI*2; 
    sPos[i*3] = r * Math.sin(theta) * Math.cos(phi); sPos[i*3+1] = Math.abs(r * Math.sin(theta) * Math.sin(phi)) + 5; sPos[i*3+2] = r * Math.cos(theta);
}
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.2, color: 0xffffff })));

// Lighting
scene.add(new THREE.AmbientLight(0x333333));
const l1 = new THREE.PointLight(0xffaa55, 0.8, 15); l1.position.set(0.4, 3.5, 4.7); scene.add(l1);
const l2 = new THREE.PointLight(0x444455, 0.6, 20); l2.position.set(-7.5, 5, 8); scene.add(l2);

// Interaction
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(0, 0); 
document.addEventListener('mousedown', () => {
    if (!isPlaying || gameOver) return;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactables);
    if (hits.length > 0 && hits[0].distance < 4) {
        const o = hits[0].object;
        if (o.userData.type === 'main door') { doorOpen = !doorOpen; mainDoorTargetRot = doorOpen ? -Math.PI/2 : 0; }
        if (o.userData.type === 'closet door') { closetDoorOpen = !closetDoorOpen; closetDoorTargetRot = closetDoorOpen ? -Math.PI/2 : 0; }
        if (o.userData.type === 'window') interactionText.innerText = "It's pitch black out there...";
        setTimeout(() => interactionText.innerText = "", 2000);
    }
});

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    if (isPlaying && !gameOver) {
        const delta = clock.getDelta(); gameTime += delta;
        mainHinge.rotation.y = THREE.MathUtils.lerp(mainHinge.rotation.y, mainDoorTargetRot, delta * 5);
        closetHinge.rotation.y = THREE.MathUtils.lerp(closetHinge.rotation.y, closetDoorTargetRot, delta * 5);

        // Auto-close Proximity
        if (doorOpen && camera.position.distanceTo(mainHinge.position) > 6) { doorOpen = false; mainDoorTargetRot = 0; }
        if (closetDoorOpen && camera.position.distanceTo(closetHinge.position) > 6) { closetDoorOpen = false; closetDoorTargetRot = 0; }

        if (gameTime >= 720) {
            gameOver = true; isPlaying = false; controls.unlock(); updateClockDisplay("6:00 AM");
            gameUi.style.display = 'none'; sixAmScreen.style.display = 'flex';
            setTimeout(() => { sixAmScreen.style.opacity = '1'; setTimeout(() => { sixAmScreen.innerText = "6:00 AM"; }, 1500); }, 100);
        } else {
            const h = Math.floor(gameTime/120); const s = gameTime%120;
            let dh = 12 + h; if (dh > 12) dh -= 12;
            const ts = `${dh}${s < 60 ? ":00" : ":30"} AM`;
            if (ts !== lastTimeString) { lastTimeString = ts; updateClockDisplay(ts); }
        }

        // Hover Text
        raycaster.setFromCamera(mouse, camera);
        const hover = raycaster.intersectObjects(interactables);
        if (hover.length > 0 && hover[0].distance < 4) interactionText.innerText = `Click to interact with ${hover[0].object.userData.type}`;
        else if (interactionText.innerText.includes("Click to interact")) interactionText.innerText = "";

        let dZ = Number(move.forward) - Number(move.backward);
        let dX = Number(move.right) - Number(move.left);
        if(dX !== 0 && dZ !== 0) { const len = Math.sqrt(dX*dX+dZ*dZ); dX /= len; dZ /= len; }
        const pX = camera.position.x, pZ = camera.position.z;
        controls.moveForward(dZ * 6.0 * delta); controls.moveRight(dX * 6.0 * delta);
        const pBox = new THREE.Box3();
        const check = () => {
            pBox.setFromCenterAndSize(new THREE.Vector3(camera.position.x, 1.5, camera.position.z), new THREE.Vector3(0.8, 3, 0.8));
            for(let c of colliders) { if(pBox.intersectsBox(new THREE.Box3().setFromObject(c))) return true; }
            return false;
        };
        const nX = camera.position.x, nZ = camera.position.z;
        camera.position.x = nX; camera.position.z = pZ; if (check()) camera.position.x = pX;
        camera.position.z = nZ; if (check()) camera.position.z = pZ;
        camera.position.y = 3;
    } else { clock.getDelta(); }
    renderer.render(scene, camera);
}
animate();
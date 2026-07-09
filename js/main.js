import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Cube3D } from './cube.js';
import { initInteraction } from './interaction.js';
import { createGame } from './game.js';
import { createConfetti } from './confetti.js';

const canvas = document.getElementById('three-canvas');
const statusEl = document.getElementById('status-text');
const statusBarEl = document.getElementById('status-bar');
const playerBadgeEl = document.getElementById('player-badge');
const bannerEl = document.getElementById('banner');
const bannerMessageEl = document.getElementById('banner-message');
const newGameBtn = document.getElementById('new-game-btn');
const setupEl = document.getElementById('setup');
const rulesEl = document.getElementById('rules');
const p1Input = document.getElementById('p1-name');
const p2Input = document.getElementById('p2-name');
const nextBtn = document.getElementById('next-btn');
const startBtn = document.getElementById('start-btn');
const confetti = createConfetti(document.getElementById('confetti-canvas'));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202124);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.4, 3.2, 4.6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-4, -3, -5);
scene.add(fillLight);

const cube3D = new Cube3D(scene);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);

const game = createGame({ cube3D, statusEl, statusBarEl, playerBadgeEl, bannerEl, bannerMessageEl, newGameBtn, setupEl, rulesEl, p1Input, p2Input, nextBtn, startBtn, confetti });

initInteraction({ renderer, camera, cube3D, controls, game });

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

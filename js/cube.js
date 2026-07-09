import * as THREE from 'three';

const CUBIE_SIZE = 0.94;
const SPACING = 1.0;
const STICKER_SIZE = 0.8;
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.005;
const MARK_LOCAL_OFFSET = 0.012;
const SNAP_ANIM_MS = 150;

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const FACE_LOCAL_AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

function faceKeyFromNormal(n) {
  if (n.x === 1) return 'R';
  if (n.x === -1) return 'L';
  if (n.y === 1) return 'U';
  if (n.y === -1) return 'D';
  if (n.z === 1) return 'F';
  if (n.z === -1) return 'B';
  return null;
}

function emptyGrid() {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

// Applies N quarter-turns (derived from angleDeg) of the standard +90 rotation
// formula for the given axis. Position offsets and face normals both transform
// the same way under rotation, so this one function serves both purposes.
export function rotateIntVec(v, axis, angleDeg) {
  let { x, y, z } = v;
  const normalized = ((Math.round(angleDeg / 90) % 4) + 4) % 4;
  for (let i = 0; i < normalized; i++) {
    if (axis === 'x') {
      const ny = -z, nz = y;
      y = ny; z = nz;
    } else if (axis === 'y') {
      const nx = z, nz = -x;
      x = nx; z = nz;
    } else {
      const nx = -y, ny = x;
      x = nx; y = ny;
    }
  }
  return { x, y, z };
}

export class Cube3D {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.turningGroup = new THREE.Group();
    this.group.add(this.turningGroup);

    this.cubies = [];
    this.stickers = [];

    this._moving = false;
    this._generation = 0;
    this._turnGenAtBegin = -1;
    this._axis = null;
    this._layer = null;
    this._affected = [];

    this._buildCubies();
  }

  get isMoving() {
    return this._moving;
  }

  _buildCubies() {
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          this._buildCubie(x, y, z);
        }
      }
    }
  }

  _buildCubie(x, y, z) {
    const bodyGeo = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111113,
      roughness: 0.45,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(bodyGeo, bodyMat);
    mesh.position.set(x * SPACING, y * SPACING, z * SPACING);

    const cubieRecord = {
      mesh,
      home: { x, y, z },
      grid: { x, y, z },
      stickers: [],
    };
    mesh.userData.cubieRecord = cubieRecord;

    for (const axis of FACE_LOCAL_AXES) {
      const dot = axis.x * x + axis.y * y + axis.z * z;
      if (dot === 1) this._buildSticker(cubieRecord, axis);
    }

    this.group.add(mesh);
    this.cubies.push(cubieRecord);
  }

  _buildSticker(cubieRecord, axisLocal) {
    const geo = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisLocal);
    mesh.quaternion.copy(quat);
    mesh.position.copy(axisLocal).multiplyScalar(STICKER_OFFSET);
    cubieRecord.mesh.add(mesh);

    const stickerRecord = {
      mesh,
      cubieRecord,
      homeNormal: { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z },
      currentNormal: { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z },
      mark: null,
      markMesh: null,
    };
    mesh.userData.stickerRecord = stickerRecord;
    cubieRecord.stickers.push(stickerRecord);
    this.stickers.push(stickerRecord);
  }

  raycastCube(raycaster) {
    const objects = this.cubies.map((c) => c.mesh);
    const hits = raycaster.intersectObjects(objects, true);
    if (hits.length === 0) return { type: 'none' };
    const obj = hits[0].object;
    if (obj.userData.stickerRecord) {
      return { type: 'sticker', stickerRecord: obj.userData.stickerRecord, point: hits[0].point };
    }
    if (obj.userData.cubieRecord) {
      return { type: 'body', cubieRecord: obj.userData.cubieRecord, point: hits[0].point };
    }
    return { type: 'none' };
  }

  placeMark(stickerRecord, mark) {
    if (stickerRecord.mark) return false;
    stickerRecord.mark = mark;

    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 });

    if (mark === 'X') {
      const barGeo = new THREE.BoxGeometry(STICKER_SIZE * 0.62, STICKER_SIZE * 0.13, 0.03);
      const bar1 = new THREE.Mesh(barGeo, mat);
      bar1.rotation.z = Math.PI / 4;
      const bar2 = new THREE.Mesh(barGeo, mat);
      bar2.rotation.z = -Math.PI / 4;
      bar1.userData.stickerRecord = stickerRecord;
      bar2.userData.stickerRecord = stickerRecord;
      group.add(bar1, bar2);
    } else {
      const torusGeo = new THREE.TorusGeometry(STICKER_SIZE * 0.26, STICKER_SIZE * 0.09, 14, 28);
      const torus = new THREE.Mesh(torusGeo, mat);
      torus.userData.stickerRecord = stickerRecord;
      group.add(torus);
    }

    group.position.set(0, 0, MARK_LOCAL_OFFSET);
    stickerRecord.mesh.add(group);
    stickerRecord.markMesh = group;
    return true;
  }

  beginTurn(axis, layer) {
    this._axis = axis;
    this._layer = layer;
    this._affected = this.cubies.filter((c) => c.grid[axis] === layer);
    for (const c of this._affected) this.turningGroup.attach(c.mesh);
    this._moving = true;
    this._turnGenAtBegin = this._generation;
  }

  previewTurn(angleDeg) {
    this.turningGroup.quaternion.setFromAxisAngle(AXES[this._axis], THREE.MathUtils.degToRad(angleDeg));
  }

  async commitTurn(angleDeg) {
    await this._animateTurningGroupTo(angleDeg);
    this._finish(angleDeg);
  }

  async cancelTurn() {
    await this._animateTurningGroupTo(0);
    this._finish(0);
  }

  _animateTurningGroupTo(targetAngleDeg) {
    return new Promise((resolve) => {
      const axisVec = AXES[this._axis];
      const startQuat = this.turningGroup.quaternion.clone();
      const endQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, THREE.MathUtils.degToRad(targetAngleDeg));
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / SNAP_ANIM_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        this.turningGroup.quaternion.slerpQuaternions(startQuat, endQuat, eased);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  _finish(angleDeg) {
    if (this._turnGenAtBegin !== this._generation) {
      // A reset happened mid-animation; abandon this turn without touching state.
      this._affected = [];
      this._axis = null;
      this._layer = null;
      return;
    }

    for (const c of this._affected) {
      this.group.attach(c.mesh);
      if (angleDeg !== 0) {
        c.grid = rotateIntVec(c.grid, this._axis, angleDeg);
        for (const s of c.stickers) {
          s.currentNormal = rotateIntVec(s.currentNormal, this._axis, angleDeg);
        }
      }
    }

    this.turningGroup.quaternion.identity();
    this._affected = [];
    this._axis = null;
    this._layer = null;
    this._moving = false;
  }

  computeFaceGrids() {
    const faces = { U: emptyGrid(), D: emptyGrid(), L: emptyGrid(), R: emptyGrid(), F: emptyGrid(), B: emptyGrid() };
    for (const s of this.stickers) {
      const key = faceKeyFromNormal(s.currentNormal);
      if (!key) continue;
      const g = s.cubieRecord.grid;
      let row, col;
      if (key === 'U' || key === 'D') {
        row = g.z + 1; col = g.x + 1;
      } else if (key === 'L' || key === 'R') {
        row = g.y + 1; col = g.z + 1;
      } else {
        row = g.y + 1; col = g.x + 1;
      }
      faces[key][row][col] = s.mark;
    }
    return faces;
  }

  isFull() {
    return this.stickers.every((s) => s.mark !== null);
  }

  reset() {
    this._generation++;
    this._moving = false;
    this._affected = [];
    this._axis = null;
    this._layer = null;
    this.turningGroup.quaternion.identity();

    for (const s of this.stickers) {
      s.mark = null;
      if (s.markMesh) {
        s.mesh.remove(s.markMesh);
        s.markMesh = null;
      }
      s.currentNormal = { ...s.homeNormal };
    }

    for (const c of this.cubies) {
      c.grid = { ...c.home };
      this.group.attach(c.mesh);
      c.mesh.position.set(c.home.x * SPACING, c.home.y * SPACING, c.home.z * SPACING);
      c.mesh.quaternion.identity();
    }
  }
}

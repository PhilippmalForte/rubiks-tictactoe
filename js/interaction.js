import * as THREE from 'three';

const CLICK_THRESHOLD_PX = 5;
const ROTATE_SENSITIVITY_DEG_PER_PX = 0.6;

const AXIS_ORDER = ['x', 'y', 'z'];
const CANON = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function otherAxes(axis) {
  return AXIS_ORDER.filter((a) => a !== axis);
}

function axisOfNormal(n) {
  if (n.x !== 0) return 'x';
  if (n.y !== 0) return 'y';
  return 'z';
}

function normalize2D(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  v.x /= len;
  v.y /= len;
  return v;
}

function dot2D(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function initInteraction({ renderer, camera, cube3D, controls, game }) {
  const dom = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let pointerDownInfo = null;
  let turnState = null;
  let totalMovement = 0;

  function getNDC(event) {
    const rect = dom.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return ndc;
  }

  function raycastAtEvent(event) {
    getNDC(event);
    raycaster.setFromCamera(ndc, camera);
    return cube3D.raycastCube(raycaster);
  }

  function worldToScreen(vec3) {
    const v = vec3.clone().project(camera);
    const rect = dom.getBoundingClientRect();
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((1 - v.y) / 2) * rect.height,
    };
  }

  function computeTangentDirs(stickerMesh, axisPName, axisQName) {
    const origin = stickerMesh.getWorldPosition(new THREE.Vector3());
    const worldDirP = CANON[axisPName].clone().transformDirection(cube3D.group.matrixWorld);
    const worldDirQ = CANON[axisQName].clone().transformDirection(cube3D.group.matrixWorld);
    const tipP = origin.clone().addScaledVector(worldDirP, 0.5);
    const tipQ = origin.clone().addScaledVector(worldDirQ, 0.5);

    const screenOrigin = worldToScreen(origin);
    const screenTipP = worldToScreen(tipP);
    const screenTipQ = worldToScreen(tipQ);

    const dirP2D = normalize2D({ x: screenTipP.x - screenOrigin.x, y: screenTipP.y - screenOrigin.y });
    const dirQ2D = normalize2D({ x: screenTipQ.x - screenOrigin.x, y: screenTipQ.y - screenOrigin.y });
    return { dirP2D, dirQ2D };
  }

  function onPointerDown(event) {
    if (cube3D.isMoving || game.isGameOver()) return;
    if (pointerDownInfo && pointerDownInfo.pointerId !== event.pointerId) return;

    const hit = raycastAtEvent(event);
    pointerDownInfo = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      hit,
      phaseAtDown: game.getPhase(),
    };
    totalMovement = 0;
    turnState = null;

    if (hit.type === 'sticker' && game.getPhase() === 'rotate') {
      controls.enabled = false;
      const N = hit.stickerRecord.currentNormal;
      const nAxis = axisOfNormal(N);
      const [axisP, axisQ] = otherAxes(nAxis);
      turnState = {
        stickerRecord: hit.stickerRecord,
        cubieGrid: hit.stickerRecord.cubieRecord.grid,
        N,
        axisP,
        axisQ,
        thresholdCrossed: false,
        began: false,
      };
    }
  }

  function onPointerMove(event) {
    if (!pointerDownInfo || pointerDownInfo.pointerId !== event.pointerId) return;

    const dx = event.clientX - pointerDownInfo.x;
    const dy = event.clientY - pointerDownInfo.y;
    const dist = Math.hypot(dx, dy);
    totalMovement = Math.max(totalMovement, dist);

    if (!turnState) return; // background/body drag or place-phase drag: OrbitControls handles it

    if (!turnState.thresholdCrossed) {
      if (dist < CLICK_THRESHOLD_PX) return;
      turnState.thresholdCrossed = true;

      const { dirP2D, dirQ2D } = computeTangentDirs(turnState.stickerRecord.mesh, turnState.axisP, turnState.axisQ);
      const delta2D = { x: dx, y: dy };
      const scoreP = dot2D(delta2D, dirP2D);
      const scoreQ = dot2D(delta2D, dirQ2D);

      let dominantDir2D, dominantAxis, rotationAxis;
      if (Math.abs(scoreP) >= Math.abs(scoreQ)) {
        dominantAxis = turnState.axisP;
        rotationAxis = turnState.axisQ;
        dominantDir2D = dirP2D;
      } else {
        dominantAxis = turnState.axisQ;
        rotationAxis = turnState.axisP;
        dominantDir2D = dirQ2D;
      }

      const N_signed = new THREE.Vector3(turnState.N.x, turnState.N.y, turnState.N.z);
      const crossRN = new THREE.Vector3().crossVectors(CANON[rotationAxis], N_signed);
      const matchesDominant = crossRN.dot(CANON[dominantAxis]) > 0;

      turnState.dominantDir2D = dominantDir2D;
      turnState.signBase = matchesDominant ? 1 : -1;
      turnState.axis = rotationAxis;
      turnState.layer = turnState.cubieGrid[rotationAxis];
      turnState.liveAngle = 0;

      cube3D.beginTurn(turnState.axis, turnState.layer);
      turnState.began = true;
    }

    const delta2D = { x: dx, y: dy };
    const pixelsAlong = dot2D(delta2D, turnState.dominantDir2D);
    const sign = (Math.sign(pixelsAlong) || 1) * turnState.signBase;
    const liveAngle = sign * THREE.MathUtils.clamp(Math.abs(pixelsAlong) * ROTATE_SENSITIVITY_DEG_PER_PX, 0, 180);
    cube3D.previewTurn(liveAngle);
    turnState.liveAngle = liveAngle;
  }

  function finishTurnGesture() {
    controls.enabled = true;
    if (turnState && turnState.began) {
      const snapped = THREE.MathUtils.clamp(Math.round(turnState.liveAngle / 90) * 90, -180, 180);
      if (snapped === 0) {
        cube3D.cancelTurn();
      } else {
        const token = game.getResetToken();
        cube3D.commitTurn(snapped).then(() => game.onMoveCommitted(token));
      }
    }
    turnState = null;
  }

  function onPointerUp(event) {
    if (!pointerDownInfo || pointerDownInfo.pointerId !== event.pointerId) return;
    const info = pointerDownInfo;
    pointerDownInfo = null;

    if (turnState) {
      finishTurnGesture();
      return;
    }

    if (info.phaseAtDown === 'place' && totalMovement < CLICK_THRESHOLD_PX && info.hit.type === 'sticker') {
      game.placeMark(info.hit.stickerRecord);
    }
  }

  function onPointerCancel(event) {
    if (!pointerDownInfo || pointerDownInfo.pointerId !== event.pointerId) return;
    pointerDownInfo = null;
    if (turnState) {
      controls.enabled = true;
      if (turnState.began) cube3D.cancelTurn();
      turnState = null;
    }
  }

  dom.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
}

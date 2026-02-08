import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { downloadBlob } from '../export/download';
import type { Anchor, CustomStrand, ProjectSpecs, Stack, Strand } from '../../types/appTypes';
import { computeCustomStrandPreview, computeStackPreview, computeStrandPreview } from '../../utils/previewGeometry';

const UNIT_SCALE = 0.0254; // inch -> meters

function createSphereMesh(diameterM: number, color = 0xffffff) {
  const geom = new THREE.SphereGeometry(diameterM / 2, 24, 16);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.6 });
  return new THREE.Mesh(geom, mat);
}

function createBoxPlane(widthM: number, depthM: number, thicknessM = 0.02, color = 0xdddddd) {
  const geom = new THREE.BoxGeometry(widthM, thicknessM, depthM);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness: 0.8 });
  return new THREE.Mesh(geom, mat);
}

function createCylinderBetweenPoints(start: any, end: any, radius: number, color = 0x888888) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len <= 1e-6) return null;
  const geom = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness: 0.7 });
  const mesh = new THREE.Mesh(geom, mat);
  // align with Y axis
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  // compute orientation
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

export async function exportGlb(state: { projectSpecs: ProjectSpecs; anchors: Anchor[]; strands: Strand[]; stacks: Stack[]; customStrands: CustomStrand[] }, filename = 'project_3d.glb') {
  const { projectSpecs, anchors, strands, stacks, customStrands } = state;

  const scene = new THREE.Scene();

  // simple lighting
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(1, 2, 1);
  scene.add(dir);

  // canopy plane centered at origin; convert inches to meters
  const widthM = projectSpecs.boundaryWidthIn * UNIT_SCALE;
  const depthM = projectSpecs.boundaryHeightIn * UNIT_SCALE;
  const canopy = createBoxPlane(widthM, depthM, 0.02, 0xeeeeee);
  // place canopy at y = 0 (ceiling plane) slightly above origin so thickness extends down
  canopy.position.set(0, -0.01, 0);
  scene.add(canopy);

  // helper: anchor plan center offset
  const centerX = projectSpecs.boundaryWidthIn / 2;
  const centerY = projectSpecs.boundaryHeightIn / 2;

  // spheres and chains
  for (const s of strands) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;

    const pv = computeStrandPreview(projectSpecs, s.spec);
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;
    // place spheres
    (pv.sphereCentersY || []).forEach((centerYIn) => {
      const x = ax;
      const z = ay;
      const y = -centerYIn * UNIT_SCALE; // Y-up, hanging goes down (-Y)
      const mesh = createSphereMesh(sphereDiameterM, 0xffffff);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    });

    // top chain: from ceiling (0) to pv.topChainY2
    const topStart = new THREE.Vector3(ax, 0, ay);
    const topEnd = new THREE.Vector3(ax, -pv.topChainY2 * UNIT_SCALE, ay);
    const topCylinder = createCylinderBetweenPoints(topStart, topEnd, 0.004);
    if (topCylinder) scene.add(topCylinder);

    // bottom chain: from pv.bottomChainY1 to pv.bottomChainY2 (end)
    const bottomStart = new THREE.Vector3(ax, -pv.bottomChainY1 * UNIT_SCALE, ay);
    const bottomEnd = new THREE.Vector3(ax, -pv.bottomChainY2 * UNIT_SCALE, ay);
    const bottomCylinder = createCylinderBetweenPoints(bottomStart, bottomEnd, 0.004);
    if (bottomCylinder) scene.add(bottomCylinder);
  }

  for (const s of stacks) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;

    const pv = computeStackPreview(projectSpecs, s.spec, { sphereDiameterIn: projectSpecs.materials?.sphereDiameterIn });
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;
    (pv.sphereCentersY || []).forEach((centerYIn) => {
      const x = ax;
      const z = ay;
      const y = -centerYIn * UNIT_SCALE;
      const mesh = createSphereMesh(sphereDiameterM, 0xffffff);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    });

    const topStart = new THREE.Vector3(ax, 0, ay);
    const topEnd = new THREE.Vector3(ax, -pv.topChainY2 * UNIT_SCALE, ay);
    const topCylinder = createCylinderBetweenPoints(topStart, topEnd, 0.004);
    if (topCylinder) scene.add(topCylinder);

    const bottomStart = new THREE.Vector3(ax, -pv.bottomChainY1 * UNIT_SCALE, ay);
    const bottomEnd = new THREE.Vector3(ax, -pv.bottomChainY2 * UNIT_SCALE, ay);
    const bottomCylinder = createCylinderBetweenPoints(bottomStart, bottomEnd, 0.004);
    if (bottomCylinder) scene.add(bottomCylinder);
  }

  for (const s of customStrands) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;

    const pv = computeCustomStrandPreview(projectSpecs, s.spec, { sphereDiameterIn: projectSpecs.materials?.sphereDiameterIn });
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;

    for (const seg of pv.segments) {
      if (seg.type === "chain") {
        const start = new THREE.Vector3(ax, -seg.y1 * UNIT_SCALE, ay);
        const end = new THREE.Vector3(ax, -seg.y2 * UNIT_SCALE, ay);
        const cyl = createCylinderBetweenPoints(start, end, 0.004);
        if (cyl) scene.add(cyl);
      } else if (seg.type === "strand" || seg.type === "stack") {
        (seg.centersY || []).forEach((centerYIn) => {
          const x = ax;
          const z = ay;
          const y = -centerYIn * UNIT_SCALE;
          const mesh = createSphereMesh(sphereDiameterM, 0xffffff);
          mesh.position.set(x, y, z);
          scene.add(mesh);
        });
      }
    }
  }

  // export using GLTFExporter
  return createGlbBufferFromScene(scene).then((ab) => {
    const blob = new Blob([ab], { type: 'model/gltf-binary' });
    downloadBlob(filename, blob);
  });
}

export function createGlbBufferFromScene(scene: any): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    // GLTFExporter types can be loose across three versions; cast to any to call parse with options.
    (exporter as any).parse(
      scene,
      (result: ArrayBuffer | object) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // JSON glTF -> convert to ArrayBuffer
          try {
            const str = JSON.stringify(result, null, 2);
            const enc = new TextEncoder();
            resolve(enc.encode(str).buffer);
          } catch (e) {
            reject(e);
          }
        }
      },
      { binary: true }
    );
  });
}

export default exportGlb;

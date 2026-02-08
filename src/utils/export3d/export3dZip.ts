import { zipSync, strToU8 } from 'fflate';
import build3dLayoutJson from './export3dJson';
import { createGlbBufferFromScene } from './exportGlb';
import type { Anchor, CustomStrand, ProjectSpecs, Stack, Strand } from '../../types/appTypes';
import * as THREE from 'three';
import { computeCustomStrandPreview, computeStackPreview, computeStrandPreview } from '../../utils/previewGeometry';
import { downloadBlob } from '../export/download';

/**
 * Build GLB ArrayBuffer from state by constructing the same scene as exportGlb,
 * then package layout JSON + GLB into a ZIP and trigger download (Safari-friendly).
 */
export async function export3dZip(
  state: { projectSpecs: ProjectSpecs; anchors: Anchor[]; strands: Strand[]; stacks: Stack[]; customStrands: CustomStrand[] },
  zipFilename?: string,
  opts?: { returnBytes?: boolean },
) {
  const { projectSpecs, anchors, strands, stacks, customStrands } = state;

  // Build layout JSON
  const layout = build3dLayoutJson({ projectSpecs, anchors, strands, stacks, customStrands });
  const layoutStr = JSON.stringify(layout, null, 2);

  // Build THREE scene similarly to exportGlb, then get GLB ArrayBuffer
  // Recreate scene build logic here to avoid circular deps on scene creation function.
  const scene = new THREE.Scene();
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(1, 2, 1);
  scene.add(dir);

  const UNIT_SCALE = 0.0254;
  const widthM = projectSpecs.boundaryWidthIn * UNIT_SCALE;
  const depthM = projectSpecs.boundaryHeightIn * UNIT_SCALE;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(widthM, 0.02, depthM), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
  canopy.position.set(0, -0.01, 0);
  scene.add(canopy);

  const centerX = projectSpecs.boundaryWidthIn / 2;
  const centerY = projectSpecs.boundaryHeightIn / 2;

  for (const s of strands) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;
    const pv = computeStrandPreview(projectSpecs, s.spec);
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;
    (pv.sphereCentersY || []).forEach((centerYIn) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(sphereDiameterM / 2, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      mesh.position.set(ax, -centerYIn * UNIT_SCALE, ay);
      scene.add(mesh);
    });
  }

  for (const s of stacks) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;
    const pv = computeStackPreview(projectSpecs, s.spec, { sphereDiameterIn: projectSpecs.materials?.sphereDiameterIn });
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;
    (pv.sphereCentersY || []).forEach((centerYIn) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(sphereDiameterM / 2, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      mesh.position.set(ax, -centerYIn * UNIT_SCALE, ay);
      scene.add(mesh);
    });
  }

  for (const s of customStrands) {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const ax = anchor ? (anchor.xIn - centerX) * UNIT_SCALE : 0;
    const ay = anchor ? (anchor.yIn - centerY) * UNIT_SCALE : 0;
    const pv = computeCustomStrandPreview(projectSpecs, s.spec, { sphereDiameterIn: projectSpecs.materials?.sphereDiameterIn });
    const sphereDiameterIn = projectSpecs.materials?.sphereDiameterIn ?? 0;
    const sphereDiameterM = sphereDiameterIn * UNIT_SCALE;

    pv.segments.forEach((seg) => {
      if (seg.type === "chain") {
        const top = new THREE.Vector3(ax, -seg.y1 * UNIT_SCALE, ay);
        const bot = new THREE.Vector3(ax, -seg.y2 * UNIT_SCALE, ay);
        const len = bot.clone().sub(top).length();
        if (len > 1e-6) {
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 12), new THREE.MeshStandardMaterial({ color: 0x888888 }));
          cyl.position.copy(top).addScaledVector(bot.clone().sub(top), 0.5);
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bot.clone().sub(top).normalize());
          scene.add(cyl);
        }
      } else if (seg.type === "strand" || seg.type === "stack") {
        (seg.centersY || []).forEach((centerYIn) => {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(sphereDiameterM / 2, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
          mesh.position.set(ax, -centerYIn * UNIT_SCALE, ay);
          scene.add(mesh);
        });
      }
    });
  }

  const glbBuffer = await createGlbBufferFromScene(scene);

  // Create ZIP with fflate: put files inside a top-level folder so unzip creates that folder
  const defaultBase = 'Kelly Farley Suspened Ceramic Sculpture';
  const baseFolder = (projectSpecs.projectName && projectSpecs.projectName !== 'New Project') ? projectSpecs.projectName : defaultBase;

  const files: Record<string, Uint8Array> = {};
  files[`${baseFolder}/layout3d.json`] = strToU8(layoutStr);
  files[`${baseFolder}/model.glb`] = new Uint8Array(glbBuffer);

  const zipped = zipSync(files, { level: 6 });
  if (opts?.returnBytes) return zipped as Uint8Array;
  const blob = new Blob([zipped as any], { type: 'application/zip' });
  const name = zipFilename ?? `${baseFolder}_3D.zip`;
  downloadBlob(name, blob);
}

export default export3dZip;

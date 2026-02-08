import type { ProjectSpecs } from "../../types/appTypes";
import { parseProjectJsonText } from "../export/importProjectJson";

export const PROJECTS_DIR_NAME = "Suspended Builder Projects";
export const EXPORTS_DIR_NAME = "KPF ART";

export type ProjectListItem = {
  name: string;
  path: string;
  savedAt?: string;
  dueDate?: string;
  daysLeft?: number | null;
};

export function isTauriApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.__TAURI__ || w.__TAURI_INTERNALS__ || w.__TAURI_IPC__);
}

function sanitizeProjectName(input: string): string {
  const name = (input || "").trim();
  if (!name) return "untitled";
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function getFs() {
  return await import("@tauri-apps/plugin-fs");
}

async function getPath() {
  return await import("@tauri-apps/api/path");
}

async function getShell() {
  return await import("@tauri-apps/plugin-shell");
}

export async function getProjectsRootDir(): Promise<string> {
  const { homeDir, join } = await getPath();
  const home = await homeDir();
  return await join(home, PROJECTS_DIR_NAME);
}

export async function getExportsRootDir(): Promise<string> {
  const { documentDir, join } = await getPath();
  const docs = await documentDir();
  return await join(docs, EXPORTS_DIR_NAME);
}

export async function ensureProjectFolders(): Promise<{ projectsRoot: string; exportsRoot: string }> {
  const { mkdir } = await getFs();
  const projectsRoot = await getProjectsRootDir();
  const exportsRoot = await getExportsRootDir();
  await mkdir(projectsRoot, { recursive: true });
  await mkdir(exportsRoot, { recursive: true });
  return { projectsRoot, exportsRoot };
}

export async function ensureProjectExportDir(projectName: string): Promise<string> {
  const { mkdir } = await getFs();
  const { join } = await getPath();
  const exportsRoot = await getExportsRootDir();
  const safeName = sanitizeProjectName(projectName);
  const projectDir = await join(exportsRoot, safeName);
  await mkdir(projectDir, { recursive: true });
  return projectDir;
}

function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysUntil(dueIso: string | undefined | null): number | null {
  const dt = parseIsoDate(dueIso);
  if (!dt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dt);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function listProjectFiles(): Promise<ProjectListItem[]> {
  const { readDir, readTextFile } = await getFs();
  const { join } = await getPath();
  const projectsRoot = await getProjectsRootDir();
  const entries = await readDir(projectsRoot);
  const items: ProjectListItem[] = [];

  for (const entry of entries || []) {
    const path = (entry as any).path as string | undefined;
    const name = (entry as any).name as string | undefined;
    const filePath = path || (name ? await join(projectsRoot, name) : undefined);
    if (!filePath || !filePath.toLowerCase().endsWith(".ssp.json")) continue;
    try {
      const txt = await readTextFile(filePath);
      const parsed = parseProjectJsonText(txt);
      const specs = (parsed?.projectSpecs || {}) as ProjectSpecs;
      const projectName = sanitizeProjectName(specs.projectName || filePath.split("/").pop() || "untitled");
      const dueDate = specs.dueDate;
      const savedAt = (parsed as any)?.savedAt;
      items.push({
        name: projectName,
        path: filePath,
        savedAt,
        dueDate,
        daysLeft: daysUntil(dueDate),
      });
    } catch {
      // ignore unreadable files
    }
  }

  return items.sort((a, b) => {
    if (a.daysLeft == null && b.daysLeft == null) return a.name.localeCompare(b.name);
    if (a.daysLeft == null) return 1;
    if (b.daysLeft == null) return -1;
    return a.daysLeft - b.daysLeft;
  });
}

export async function readProjectFile(path: string): Promise<any> {
  const { readTextFile } = await getFs();
  const txt = await readTextFile(path);
  return parseProjectJsonText(txt);
}

export async function saveProjectFile(payload: unknown, projectName: string, currentPath?: string | null): Promise<string> {
  const { writeTextFile } = await getFs();
  const { join } = await getPath();
  const projectsRoot = await getProjectsRootDir();
  const safeName = sanitizeProjectName(projectName);
  const filename = `${safeName}.ssp.json`;
  const path = currentPath || (await join(projectsRoot, filename));

  const pkg = {
    schemaVersion: "1.0.0",
    savedAt: new Date().toISOString(),
    state: payload,
  };
  await writeTextFile(path, JSON.stringify(pkg, null, 2));
  return path;
}

export async function writeExportBytes(projectName: string, filename: string, bytes: Uint8Array): Promise<string> {
  const { writeFile } = await getFs();
  const { join } = await getPath();
  const dir = await ensureProjectExportDir(projectName);
  const outPath = await join(dir, filename);
  await writeFile(outPath, bytes);
  return outPath;
}

export async function writeExportText(projectName: string, filename: string, text: string): Promise<string> {
  const { writeTextFile } = await getFs();
  const { join } = await getPath();
  const dir = await ensureProjectExportDir(projectName);
  const outPath = await join(dir, filename);
  await writeTextFile(outPath, text);
  return outPath;
}

export async function openProjectsFolder(): Promise<void> {
  const { open } = await getShell();
  const dir = await getProjectsRootDir();
  await open(dir);
}

export async function openExportsFolder(projectName?: string): Promise<void> {
  const { open } = await getShell();
  const dir = projectName ? await ensureProjectExportDir(projectName) : await getExportsRootDir();
  await open(dir);
}

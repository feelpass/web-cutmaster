// 브라우저 로컬 저장소.
// - 현재 작업 중 프로젝트: 자동 저장 (로그인 없이도 새로고침 시 유지).
// - 저장된 프로젝트 목록: 명시적 "저장"으로 쌓이는 다중 프로젝트 저장소.

import { projectFromJson, projectToJson, type Project } from './domain/models';
import { attachColorPresets, registerColorPresetsFromJson } from './colorPresets';

const CURRENT_KEY = 'cutmaster.currentProject';
const PROJECTS_KEY = 'cutmaster.projects';

export interface LocalProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
  partCount: number;
}

// === 현재 프로젝트 자동 저장 ===

export function saveLocalProject(project: Project): void {
  try {
    const json = attachColorPresets(projectToJson(project), project.parts);
    localStorage.setItem(CURRENT_KEY, JSON.stringify(json));
  } catch {
    // storage 불가(사파리 시크릿 등) — 무시.
  }
}

export function loadLocalProject(): Project | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw == null) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    registerColorPresetsFromJson(j);
    return projectFromJson(j);
  } catch {
    return null;
  }
}

// === 저장된 프로젝트 목록 (id → project JSON) ===

type ProjectMap = Record<string, Record<string, unknown>>;

function readMap(): ProjectMap {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw == null) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed != null ? (parsed as ProjectMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: ProjectMap): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(map));
}

export function saveProjectToLocal(project: Project): void {
  const map = readMap();
  const json = projectToJson({ ...project, updatedAt: new Date().toISOString() });
  map[project.id] = attachColorPresets(json, project.parts);
  writeMap(map);
}

export function listLocalProjects(): LocalProjectMeta[] {
  const map = readMap();
  return Object.values(map)
    .map((j) => ({
      id: (j.id as string) ?? '',
      name: (j.name as string) ?? '(이름 없음)',
      updatedAt: (j.updatedAt as string) ?? '',
      partCount: Array.isArray(j.parts) ? j.parts.length : 0,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadLocalProjectById(id: string): Project | null {
  const map = readMap();
  const j = map[id];
  if (j == null) return null;
  try {
    registerColorPresetsFromJson(j);
    return projectFromJson(j);
  } catch {
    return null;
  }
}

export function deleteLocalProject(id: string): void {
  const map = readMap();
  delete map[id];
  writeMap(map);
}

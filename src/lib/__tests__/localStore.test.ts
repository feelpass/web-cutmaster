// localStore.ts — 현재 프로젝트 자동 저장과 저장된 프로젝트 목록 CRUD 검증.
// node 환경엔 localStorage 가 없어 메모리 스텁으로 대체한다.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createCutPart, createProject } from '../domain/models';
import {
  deleteLocalProject,
  listLocalProjects,
  loadLocalProject,
  loadLocalProjectById,
  saveLocalProject,
  saveProjectToLocal,
} from '../localStore';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

function sampleProject(id = 'proj1', name = '주방장') {
  const p = createProject(id, name);
  p.parts = [
    createCutPart({ id: 'p1', length: 700, width: 400, qty: 2, label: '측판' }),
    createCutPart({ id: 'p2', length: 600, width: 400, qty: 1, label: '상판' }),
  ];
  p.orderNumber = 'ORD-1';
  return p;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('현재 프로젝트 자동 저장', () => {
  test('save → load round-trip', () => {
    const p = sampleProject();
    saveLocalProject(p);
    expect(loadLocalProject()).toEqual(p);
  });

  test('저장된 것이 없으면 null', () => {
    expect(loadLocalProject()).toBeNull();
  });

  test('저장 데이터가 손상돼도 예외 없이 null', () => {
    localStorage.setItem('cutmaster.currentProject', '{broken json');
    expect(loadLocalProject()).toBeNull();
  });

  test('localStorage 가 아예 없어도(사파리 시크릿) 예외를 던지지 않음', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveLocalProject(sampleProject())).not.toThrow();
    expect(loadLocalProject()).toBeNull();
  });
});

describe('저장된 프로젝트 목록', () => {
  test('save → list → loadById round-trip (updatedAt 은 저장 시각으로 갱신)', () => {
    const p = sampleProject();
    saveProjectToLocal(p);

    const list = listLocalProjects();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'proj1', name: '주방장', partCount: 2 });

    const loaded = loadLocalProjectById('proj1')!;
    expect(loaded).not.toBeNull();
    expect(loaded.parts).toEqual(p.parts);
    expect(loaded.orderNumber).toBe('ORD-1');
    expect(Date.parse(loaded.updatedAt)).toBeGreaterThanOrEqual(Date.parse(p.updatedAt));
  });

  test('같은 id 로 다시 저장하면 덮어씀', () => {
    const p = sampleProject();
    saveProjectToLocal(p);
    saveProjectToLocal({ ...p, name: '주방장-수정' });
    const list = listLocalProjects();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('주방장-수정');
  });

  test('목록은 updatedAt 내림차순 정렬', () => {
    saveProjectToLocal({ ...sampleProject('a', '먼저') });
    // updatedAt 은 저장 시각 — 나중에 저장한 쪽이 앞에 온다.
    saveProjectToLocal({ ...sampleProject('b', '나중') });
    const map = JSON.parse(localStorage.getItem('cutmaster.projects')!);
    // 같은 ms 에 저장돼 순서가 애매해지지 않게 명시적으로 시각을 벌린다.
    map.a.updatedAt = '2026-07-01T00:00:00.000Z';
    map.b.updatedAt = '2026-07-02T00:00:00.000Z';
    localStorage.setItem('cutmaster.projects', JSON.stringify(map));
    expect(listLocalProjects().map((m) => m.id)).toEqual(['b', 'a']);
  });

  test('삭제하면 목록과 loadById 에서 사라짐', () => {
    saveProjectToLocal(sampleProject());
    deleteLocalProject('proj1');
    expect(listLocalProjects()).toHaveLength(0);
    expect(loadLocalProjectById('proj1')).toBeNull();
  });

  test('없는 id 는 null', () => {
    expect(loadLocalProjectById('ghost')).toBeNull();
  });

  test('목록 데이터가 손상돼도 빈 목록으로 복구', () => {
    localStorage.setItem('cutmaster.projects', 'not-json');
    expect(listLocalProjects()).toEqual([]);
    // 손상된 상태에서도 새 저장이 가능해야 한다.
    saveProjectToLocal(sampleProject());
    expect(listLocalProjects()).toHaveLength(1);
  });
});

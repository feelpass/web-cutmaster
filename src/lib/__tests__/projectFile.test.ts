// projectFile.ts — .cutmaster 파일 읽기 검증.
// (저장 경로는 브라우저 API(showSaveFilePicker/DOM) 의존이라 여기서는 읽기만 다룬다.)

import { describe, expect, test } from 'vitest';
import { createCutPart, createProject, projectToJson } from '../domain/models';
import { colorPresetById } from '../colorPresets';
import { readProjectFile } from '../projectFile';

function fileOf(content: string, name = 'test.cutmaster'): File {
  return new File([content], name, { type: 'application/json' });
}

describe('readProjectFile', () => {
  test('projectToJson 으로 만든 파일을 그대로 복원 (round-trip)', async () => {
    const p = createProject('proj1', '거실장');
    p.parts = [createCutPart({ id: 'p1', length: 700, width: 400, qty: 2, label: '측판', edges: ['E1', '', 'E1', ''] })];
    p.kerf = 4;
    p.dueDate = '2026-08-01T00:00:00.000Z';

    const loaded = await readProjectFile(fileOf(JSON.stringify(projectToJson(p))));
    expect(loaded).toEqual(p);
  });

  test('동봉된 colorPresets 를 프리셋 스토어에 등록', async () => {
    const json = {
      schemaVersion: 4,
      id: 'proj2',
      name: '데스크톱에서 옴',
      parts: [{ id: 'p1', length: 100, width: 50, qty: 1, colorPresetId: 'cp_file_xy99' }],
      colorPresets: [{ id: 'cp_file_xy99', name: '파일자재', argb: 0xffaabbcc }],
    };
    const loaded = await readProjectFile(fileOf(JSON.stringify(json)));
    expect(loaded.parts[0].colorPresetId).toBe('cp_file_xy99');
    expect(colorPresetById('cp_file_xy99')?.name).toBe('파일자재');
  });

  test('데스크톱 최소 스키마(옵션 필드 없음)도 기본값으로 로드', async () => {
    const loaded = await readProjectFile(fileOf(JSON.stringify({ schemaVersion: 4, id: 'x', name: '최소' })));
    expect(loaded.kerf).toBe(3);
    expect(loaded.parts).toEqual([]);
    expect(loaded.edgeMargin).toBe(30);
  });

  test('JSON 이 아니면 reject', async () => {
    await expect(readProjectFile(fileOf('not json at all'))).rejects.toThrow();
  });

  test('미래 schemaVersion 파일은 reject', async () => {
    await expect(readProjectFile(fileOf(JSON.stringify({ schemaVersion: 99, id: 'x', name: 'x' })))).rejects.toThrow(/Unsupported schemaVersion/);
  });
});

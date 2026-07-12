// 커스텀 자재 프리셋 스토어 — find-or-create 와 프로젝트 JSON 동봉/복원 round-trip 검증.
// (node 환경엔 localStorage 가 없어 메모리에서만 유지된다.)

import { describe, expect, test } from 'vitest';
import {
  attachColorPresets,
  colorPresetById,
  findOrCreateColorByName,
  registerColorPresetsFromJson,
} from '../colorPresets';

describe('findOrCreateColorByName', () => {
  test('빈 이름은 null(자동 색상)', () => {
    expect(findOrCreateColorByName('')).toBeNull();
    expect(findOrCreateColorByName('  ')).toBeNull();
  });

  test('seed 프리셋 이름과 일치하면 그 id', () => {
    expect(findOrCreateColorByName('백색멜라민')).toBe('cp_white_mel');
  });

  test('없는 이름은 프리셋을 자동 생성하고, 같은 이름은 같은 id 를 재사용', () => {
    const id1 = findOrCreateColorByName('E0화이트');
    const id2 = findOrCreateColorByName('E0화이트');
    expect(id1).not.toBeNull();
    expect(id2).toBe(id1);
    expect(colorPresetById(id1)?.name).toBe('E0화이트');
  });
});

describe('attachColorPresets / registerColorPresetsFromJson', () => {
  test('저장 시 부품이 참조하는 프리셋을 동봉하고, 로드 시 복원된다', () => {
    const id = findOrCreateColorByName('특수LPM')!;
    const json = attachColorPresets({ id: 'p1' }, [
      { colorPresetId: id },
      { colorPresetId: null },
    ]);
    expect(json.colorPresets).toEqual([{ id, name: '특수LPM', argb: expect.any(Number) }]);

    // 다른 브라우저에서 여는 상황: 스토어에 없는 id 를 JSON 에서 등록.
    const foreign = { colorPresets: [{ id: 'cp_desktop_ab12', name: '데스크톱자재', argb: 0xff123456 }] };
    registerColorPresetsFromJson(foreign);
    expect(colorPresetById('cp_desktop_ab12')?.name).toBe('데스크톱자재');
  });

  test('부품이 프리셋을 안 쓰면 colorPresets 키를 넣지 않는다', () => {
    const json = attachColorPresets({ id: 'p1' }, [{ colorPresetId: null }]);
    expect('colorPresets' in json).toBe(false);
  });

  test('seed id 와 잘못된 항목은 등록하지 않는다', () => {
    registerColorPresetsFromJson({
      colorPresets: [
        { id: 'cp_white_mel', name: '변조시도', argb: 0 },
        { id: 42, name: 'bad', argb: 0 },
        'garbage',
      ],
    });
    expect(colorPresetById('cp_white_mel')?.name).toBe('백색멜라민');
  });
});

// partColor.ts — 프리셋 우선/auto 폴백 색상과 텍스트 대비 검증.
// (node 환경엔 localStorage 가 없어 커스텀 프리셋은 메모리에서만 유지된다.)

import { describe, expect, test } from 'vitest';
import { createCutPart } from '../domain/models';
import { autoPartColor, partFillColor, partTextColor } from '../partColor';

describe('autoPartColor', () => {
  test('같은 id 는 항상 같은 색 (deterministic)', () => {
    expect(autoPartColor('part-abc')).toBe(autoPartColor('part-abc'));
  });

  test('다른 id 는 (일반적으로) 다른 hue', () => {
    expect(autoPartColor('part-a')).not.toBe(autoPartColor('part-b'));
  });

  test('hsl(hue, 65%, 55%) 형식, hue 0~360', () => {
    const m = autoPartColor('any-id').match(/^hsl\((\d+\.\d), 65%, 55%\)$/);
    expect(m).not.toBeNull();
    const hue = Number(m![1]);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe('partFillColor', () => {
  test('colorPresetId 가 있으면 프리셋 색', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1, colorPresetId: 'cp_red' });
    expect(partFillColor(p)).toBe('#ef4444');
  });

  test('프리셋이 없으면 id 기반 auto 색', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1 });
    expect(partFillColor(p)).toBe(autoPartColor('p1'));
  });

  test('모르는 프리셋 id 도 auto 색으로 폴백', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1, colorPresetId: 'cp_ghost' });
    expect(partFillColor(p)).toBe(autoPartColor('p1'));
  });
});

describe('partTextColor', () => {
  test('밝은 프리셋 → 어두운 텍스트', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1, colorPresetId: 'cp_white_mel' });
    expect(partTextColor(p)).toBe('#1f2937');
  });

  test('어두운 프리셋 → 흰 텍스트', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1, colorPresetId: 'cp_ebony' });
    expect(partTextColor(p)).toBe('#ffffff');
  });

  test('auto 색(프리셋 없음) → 항상 흰 텍스트', () => {
    const p = createCutPart({ id: 'p1', length: 1, width: 1, qty: 1 });
    expect(partTextColor(p)).toBe('#ffffff');
  });
});

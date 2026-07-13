// domain/presets.ts — seed 프리셋 조회, ARGB→CSS 변환, 대비 텍스트 색 검증.

import { describe, expect, test } from 'vitest';
import { argbToCss, colorPresetById, contrastTextColor, seedColorPresets } from '../presets';

describe('argbToCss', () => {
  test('알파를 버리고 #rrggbb 로 변환', () => {
    expect(argbToCss(0xffef4444)).toBe('#ef4444');
  });

  test('상위 자리가 0 이어도 6자리로 패딩', () => {
    expect(argbToCss(0xff000012)).toBe('#000012');
    expect(argbToCss(0xff00ab00)).toBe('#00ab00');
  });
});

describe('colorPresetById', () => {
  test('null → null (자동 색상)', () => {
    expect(colorPresetById(null)).toBeNull();
  });

  test('seed id 로 조회', () => {
    expect(colorPresetById('cp_white_mel')?.name).toBe('백색멜라민');
  });

  test('모르는 id → null', () => {
    expect(colorPresetById('cp_unknown')).toBeNull();
  });
});

describe('contrastTextColor', () => {
  test('밝은 배경 → 어두운 텍스트', () => {
    expect(contrastTextColor(0xfff7f7f2)).toBe('#1f2937'); // 백색멜라민
  });

  test('어두운 배경 → 흰 텍스트', () => {
    expect(contrastTextColor(0xff262626)).toBe('#ffffff'); // 검정멜라민
  });
});

describe('seedColorPresets', () => {
  test('id 중복 없음', () => {
    const ids = seedColorPresets.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('이름 중복 없음 (이름으로 find-or-create 하므로 중요)', () => {
    const names = seedColorPresets.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('모든 argb 는 불투명(알파 0xff)', () => {
    for (const c of seedColorPresets) {
      expect(c.argb >>> 24, `${c.id} 알파`).toBe(0xff);
    }
  });
});

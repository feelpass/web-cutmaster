// partsExport 는 partsImport 의 역방향 — matrix → parse → toCutParts 로 round-trip 이 성립해야 한다.

import { describe, expect, test } from 'vitest';
import { createCutPart, genId } from '../models';
import { parsePartMatrix, toCutParts } from '../partsImport';
import { partsToMatrix } from '../partsExport';

describe('partsToMatrix', () => {
  test('첫 행은 헤더', () => {
    const [header] = partsToMatrix([]);
    expect(header).toEqual([
      'PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY', 'ARTICLE',
      'EDGE1', 'EDGE2', 'EDGE3', 'EDGE4', 'FILE', 'GROOVE',
    ]);
  });

  test('colorPresetId 있으면 MATERIAL 은 색상명_두께T, 자동이면 빈칸', () => {
    const parts = [
      createCutPart({ id: genId(), length: 10, width: 10, qty: 1, colorPresetId: 'cp_white_mel', thickness: 18 }),
      createCutPart({ id: genId(), length: 10, width: 10, qty: 1, colorPresetId: null, thickness: 15 }),
    ];
    const [, row1, row2] = partsToMatrix(parts);
    expect(row1[4]).toBe('백색멜라민_18T');
    expect(row2[4]).toBe('');
  });

  test('GrainDirection → 0/1/2', () => {
    const parts = [
      createCutPart({ id: genId(), length: 10, width: 10, qty: 1, grainDirection: 'none' }),
      createCutPart({ id: genId(), length: 10, width: 10, qty: 1, grainDirection: 'lengthwise' }),
      createCutPart({ id: genId(), length: 10, width: 10, qty: 1, grainDirection: 'widthwise' }),
    ];
    expect(partsToMatrix(parts).slice(1).map((r) => r[5])).toEqual([0, 1, 2]);
  });
});

describe('round-trip', () => {
  test('export → import 하면 원본 필드가 보존된다(ARTICLE 제외)', () => {
    const original = [
      createCutPart({
        id: genId(), label: '측판', length: 600, width: 400, qty: 2,
        colorPresetId: 'cp_white_mel', thickness: 18, grainDirection: 'lengthwise',
        edges: ['ABS', '', 'ABS', ''], fileName: 'door.dxf', groove: 'G6',
      }),
      createCutPart({
        id: genId(), label: '도어', length: 700, width: 350, qty: 1,
        colorPresetId: null, thickness: 15, grainDirection: 'none',
        edges: ['', '', '', ''], fileName: '', groove: '',
      }),
    ];

    // matrix 는 (string|number)[][] 이지만 파서는 문자열 셀을 가정하므로 sheet_to_json({raw:false}) 처럼 문자열화한다.
    const matrix = partsToMatrix(original).map((row) => row.map(String));
    const roundTripped = toCutParts(parsePartMatrix(matrix));

    expect(roundTripped).toHaveLength(2);
    roundTripped.forEach((p, i) => {
      const o = original[i];
      expect(p.label).toBe(o.label);
      expect(p.length).toBe(o.length);
      expect(p.width).toBe(o.width);
      expect(p.qty).toBe(o.qty);
      expect(p.thickness).toBe(o.thickness);
      expect(p.colorPresetId).toBe(o.colorPresetId);
      expect(p.grainDirection).toBe(o.grainDirection);
      expect(p.edges).toEqual(o.edges);
      expect(p.fileName).toBe(o.fileName);
      expect(p.groove).toBe(o.groove);
    });
  });
});

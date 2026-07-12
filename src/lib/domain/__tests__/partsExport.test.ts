// partsExport 는 partsImport 의 역방향 — matrix → parse → toCutParts 로 round-trip 이 성립해야 한다.

import { describe, expect, test } from 'vitest';
import { createCutPart, genId } from '../models';
import { parsePartMatrix, toCutParts } from '../partsImport';
import { partsToCsv, partsToMatrix } from '../partsExport';

describe('partsToMatrix', () => {
  test('첫 행은 헤더 (데스크톱 PartsCsvExporter와 동일 — ORIENTATION 포함)', () => {
    const [header] = partsToMatrix([]);
    expect(header).toEqual([
      'PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY', 'ARTICLE',
      'EDGE1', 'EDGE2', 'EDGE3', 'EDGE4', 'FILE', 'GROOVE', 'ORIENTATION',
    ]);
  });

  test('ARTICLE 컬럼에 프로젝트명, ORIENTATION 은 항상 1', () => {
    const parts = [createCutPart({ id: genId(), length: 10, width: 10, qty: 1 })];
    const [, row] = partsToMatrix(parts, undefined, '4단도어장');
    expect(row[7]).toBe('4단도어장');
    expect(row[14]).toBe(1);
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

describe('partsToCsv', () => {
  test('데스크톱 CSV 형식: BOM + CRLF, 커스텀 자재명_두께T 포함', () => {
    const parts = [
      createCutPart({
        id: genId(), label: '이동선반', length: 760, width: 356, qty: 10,
        colorPresetId: 'cp_x', thickness: 23,
      }),
    ];
    const csv = partsToCsv(parts, '4단도어장', (id) => (id === 'cp_x' ? '화이트' : ''));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('PART,W,D,T,MATERIAL,GRAIN,QTY,ARTICLE,EDGE1,EDGE2,EDGE3,EDGE4,FILE,GROOVE,ORIENTATION');
    expect(lines[1]).toBe('이동선반,760,356,23,화이트_23T,0,10,4단도어장,,,,,,,1');
  });

  test('콤마/따옴표가 든 셀은 escape 된다', () => {
    const parts = [
      createCutPart({ id: genId(), label: '선반,좌"우', length: 10, width: 10, qty: 1 }),
    ];
    const csv = partsToCsv(parts, '');
    expect(csv).toContain('"선반,좌""우"');
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

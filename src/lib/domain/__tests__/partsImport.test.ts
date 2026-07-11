// cutmaster(Flutter) test/data/csv/parts_csv_importer_test.dart 대응 — 컬럼 규약/파싱 동작 검증.

import { describe, expect, test } from 'vitest';
import { parseMaterial, parsePartMatrix, toCutParts } from '../partsImport';

describe('parseMaterial', () => {
  test('색상명_두께T 형식을 분리한다', () => {
    expect(parseMaterial('백색멜라민_18T')).toEqual({ name: '백색멜라민', thickness: 18 });
    expect(parseMaterial('오크_15T')).toEqual({ name: '오크', thickness: 15 });
    expect(parseMaterial('회색MDF_9t')).toEqual({ name: '회색MDF', thickness: 9 });
  });

  test('형식이 안 맞으면 전체를 이름으로, 두께 0', () => {
    expect(parseMaterial('화이트')).toEqual({ name: '화이트', thickness: 0 });
    expect(parseMaterial('_18T')).toEqual({ name: '_18T', thickness: 0 });
    expect(parseMaterial('오크_큰')).toEqual({ name: '오크_큰', thickness: 0 });
    expect(parseMaterial('')).toEqual({ name: '', thickness: 0 });
  });
});

describe('parsePartMatrix', () => {
  const header = ['PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY'];

  test('헤더 컬럼명은 대소문자·공백 무시로 매칭한다', () => {
    const rows = parsePartMatrix([
      [' part ', 'w', 'd', 't', 'material', 'grain', 'qty'],
      ['측판', '600', '400', '18', '백색멜라민_18T', '1', '2'],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('측판');
    expect(rows[0].length).toBe(600);
    expect(rows[0].width).toBe(400);
  });

  test('PART가 비면 행을 건너뛴다', () => {
    const rows = parsePartMatrix([
      header,
      ['', '600', '400', '18', '', '0', '1'],
      ['도어', '700', '350', '18', '', '0', '1'],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('도어');
  });

  test('GRAIN 0/1/2 → none/lengthwise/widthwise', () => {
    const rows = parsePartMatrix([
      header,
      ['a', '10', '10', '18', '', '0', '1'],
      ['b', '10', '10', '18', '', '1', '1'],
      ['c', '10', '10', '18', '', '2', '1'],
    ]);
    expect(rows.map((r) => r.grain)).toEqual(['none', 'lengthwise', 'widthwise']);
  });

  test('MATERIAL 두께가 있으면 우선, 없으면 T 칼럼으로 fallback', () => {
    const rows = parsePartMatrix([
      header,
      ['a', '10', '10', '18', '오크_15T', '0', '1'], // MATERIAL 두께 15 우선
      ['b', '10', '10', '25', '화이트', '0', '1'], // 형식 불충족 → T=25
    ]);
    expect(rows[0].materialThickness).toBe(15);
    expect(rows[1].materialThickness).toBe(25);
  });

  test('QTY 누락/비정상은 1로, 소수는 반올림', () => {
    const rows = parsePartMatrix([
      header,
      ['a', '10', '10', '18', '', '0', ''],
      ['b', '10', '10', '18', '', '0', '3'],
    ]);
    expect(rows[0].qty).toBe(1);
    expect(rows[1].qty).toBe(3);
  });

  test('빈 매트릭스는 빈 배열', () => {
    expect(parsePartMatrix([])).toEqual([]);
  });
});

describe('toCutParts', () => {
  test('색상명이 seed 프리셋과 일치하면 colorPresetId 매칭, 아니면 null', () => {
    const rows = parsePartMatrix([
      ['PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY'],
      ['a', '10', '10', '18', '백색멜라민_18T', '0', '1'], // 매칭
      ['b', '10', '10', '18', '없는색상_18T', '0', '1'], // 미매칭
    ]);
    const parts = toCutParts(rows);
    expect(parts[0].colorPresetId).toBe('cp_white_mel');
    expect(parts[1].colorPresetId).toBeNull();
    expect(parts.every((p) => p.id !== '')).toBe(true);
  });

  test('EDGE/FILE/GROOVE 컬럼을 부품에 반영한다', () => {
    const rows = parsePartMatrix([
      ['PART', 'W', 'D', 'EDGE1', 'EDGE2', 'EDGE3', 'EDGE4', 'FILE', 'GROOVE'],
      ['a', '10', '10', 'ABS', '', 'ABS', '', 'door.dxf', 'G6'],
    ]);
    const [p] = toCutParts(rows);
    expect(p.edges).toEqual(['ABS', '', 'ABS', '']);
    expect(p.fileName).toBe('door.dxf');
    expect(p.groove).toBe('G6');
  });
});

// 원장 자재 카탈로그 — seed 규격, 커스텀 추가/삭제, Default 선택/폴백 검증.
// (node 환경엔 localStorage 가 없어 메모리에서만 유지된다.)

import { describe, expect, test } from 'vitest';
import {
  addStockMaterial,
  allStockMaterials,
  deleteStockMaterial,
  getDefaultStockMaterial,
  isSeedStockMaterial,
  seedStockMaterials,
  setDefaultStockMaterialId,
  stockMaterialById,
} from '../stockMaterials';

describe('seed 자재', () => {
  test('4×8자, 4×9자, 4×10자가 기본 제공된다', () => {
    const all = allStockMaterials();
    expect(all.find((m) => m.name === '4×8자')).toMatchObject({ length: 2440, width: 1220 });
    expect(all.find((m) => m.name === '4×9자')).toMatchObject({ length: 2745, width: 1220 });
    expect(all.find((m) => m.name === '4×10자')).toMatchObject({ length: 3050, width: 1220 });
  });

  test('Default는 4×8자(2440×1220)', () => {
    const def = getDefaultStockMaterial();
    expect(def.id).toBe(seedStockMaterials[0].id);
    expect(def.length).toBe(2440);
    expect(def.width).toBe(1220);
  });
});

describe('커스텀 자재 추가/삭제와 Default 선택', () => {
  test('추가한 자재는 목록에 나타나고 seed가 아니다', () => {
    const created = addStockMaterial('수입 PB 특규격', 2800, 1250);
    expect(stockMaterialById(created.id)).toMatchObject({
      name: '수입 PB 특규격',
      length: 2800,
      width: 1250,
    });
    expect(isSeedStockMaterial(created.id)).toBe(false);
    deleteStockMaterial(created.id);
  });

  test('seed 자재는 삭제되지 않는다', () => {
    deleteStockMaterial('sm_4x9');
    expect(stockMaterialById('sm_4x9')).not.toBeNull();
  });

  test('Default 지정 후 그 자재를 삭제하면 4×8자로 되돌아간다', () => {
    const created = addStockMaterial('임시 규격', 3000, 1300);
    setDefaultStockMaterialId(created.id);
    expect(getDefaultStockMaterial().id).toBe(created.id);
    deleteStockMaterial(created.id);
    expect(getDefaultStockMaterial().id).toBe(seedStockMaterials[0].id);
  });

  test('seed도 Default로 선택할 수 있다', () => {
    setDefaultStockMaterialId('sm_4x10');
    expect(getDefaultStockMaterial().name).toBe('4×10자');
    setDefaultStockMaterialId(seedStockMaterials[0].id);
  });
});

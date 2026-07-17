// calculate.ts — 자재(color+두께)별 그룹핑, 헤드컷 오프셋, 효율 계산 검증.
// (solver_provider.runCalculate 포팅 — 솔버 자체는 treeSearchSolver.test.ts 에서 검증)

import { describe, expect, test } from 'vitest';
import { calculatePlan } from '../calculate';
import { createCutPart, createProject, drawLength, drawWidth } from '../models';

function projectWith(parts: ReturnType<typeof createCutPart>[]) {
  const p = createProject('proj1', '테스트');
  p.parts = parts;
  return p;
}

describe('calculatePlan', () => {
  test('부품이 없으면 빈 plan (효율 0)', () => {
    const plan = calculatePlan(createProject('proj1', '빈'));
    expect(plan.sheets).toEqual([]);
    expect(plan.unplaced).toEqual([]);
    expect(plan.efficiencyPercent).toBe(0);
  });

  test('단일 자재 — 표준 시트(2440×1220)에 전부 배치', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 1200, width: 600, qty: 4, label: 'A' }),
    ]);
    const plan = calculatePlan(project);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0].sheetLength).toBe(2440);
    expect(plan.sheets[0].sheetWidth).toBe(1220);
    expect(plan.sheets[0].placed).toHaveLength(4);
    expect(plan.efficiencyPercent).toBeGreaterThan(0);
  });

  test('Default 원장 규격 지정 — 4×10자(3050×1220)에는 2440 초과 부품도 배치된다', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 2900, width: 600, qty: 1, label: 'L' }),
    ]);
    // 기본(4×8자)에서는 배치 불가.
    expect(calculatePlan(project).unplaced).toHaveLength(1);
    // 4×10자 규격을 넘기면 배치된다.
    const plan = calculatePlan(project, undefined, {
      defaultSize: { length: 3050, width: 1220 },
    });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0].sheetLength).toBe(3050);
    expect(plan.sheets[0].sheetWidth).toBe(1220);
  });

  test('부품별 원장 자재 — stockMaterialId 가 다른 부품은 각자 규격의 시트에 배치', () => {
    const project = projectWith([
      createCutPart({ id: 'pBig', length: 2900, width: 600, qty: 1, stockMaterialId: 'sm_4x10' }),
      createCutPart({ id: 'pStd', length: 600, width: 400, qty: 1 }), // Default (4×8)
    ]);
    const plan = calculatePlan(project, undefined, {
      sizeById: { sm_4x10: { length: 3050, width: 1220 } },
    });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(2);
    const bySize = new Map(plan.sheets.map((s) => [s.sheetLength, s]));
    expect(bySize.get(3050)?.placed.map((p) => p.part.id)).toEqual(['pBig']);
    expect(bySize.get(2440)?.placed.map((p) => p.part.id)).toEqual(['pStd']);
  });

  test('자재(두께)별로 그룹핑 — 시트끼리 부품이 섞이지 않음', () => {
    const project = projectWith([
      createCutPart({ id: 'p18', length: 600, width: 400, qty: 2, thickness: 18 }),
      createCutPart({ id: 'p15', length: 600, width: 400, qty: 2, thickness: 15 }),
    ]);
    const plan = calculatePlan(project);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(2);
    for (const sheet of plan.sheets) {
      const thicknesses = new Set(sheet.placed.map((pp) => pp.part.thickness));
      expect(thicknesses.size).toBe(1);
    }
  });

  test('colorPresetId 가 다르면 별도 자재 그룹', () => {
    const project = projectWith([
      createCutPart({ id: 'pr', length: 600, width: 400, qty: 1, colorPresetId: 'cp_red' }),
      createCutPart({ id: 'pn', length: 600, width: 400, qty: 1 }),
    ]);
    const plan = calculatePlan(project);
    expect(plan.sheets).toHaveLength(2);
  });

  test('헤드컷 — 부품 좌표가 오프셋되고 시트 치수는 원본 유지', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 600, width: 400, qty: 3 }),
    ]);
    project.headcutLeft = 100;
    project.headcutTop = 50;
    const plan = calculatePlan(project);
    expect(plan.unplaced).toHaveLength(0);
    const sheet = plan.sheets[0];
    // 시각화용 시트 치수는 헤드컷 미적용 원본.
    expect(sheet.sheetLength).toBe(2440);
    expect(sheet.sheetWidth).toBe(1220);
    for (const pp of sheet.placed) {
      expect(pp.x).toBeGreaterThanOrEqual(100);
      expect(pp.y).toBeGreaterThanOrEqual(50);
      // 유효 영역(2440-100 × 1220-50) 밖으로 나가지 않음.
      expect(pp.x + drawLength(pp)).toBeLessThanOrEqual(2440 + 0.001);
      expect(pp.y + drawWidth(pp)).toBeLessThanOrEqual(1220 + 0.001);
    }
    for (const r of sheet.leftovers) {
      expect(r.x).toBeGreaterThanOrEqual(100);
      expect(r.y).toBeGreaterThanOrEqual(50);
    }
  });

  test('헤드컷으로 유효 영역보다 커진 부품은 unplaced', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 2400, width: 600, qty: 1 }),
    ]);
    project.headcutLeft = 50;
    project.headcutRight = 50; // 유효 길이 2340 < 2400
    const plan = calculatePlan(project);
    expect(plan.unplaced).toHaveLength(1);
    expect(plan.unplaced[0].id).toBe('p1');
  });

  test('효율은 헤드컷 제외 유효 영역 기준', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 1170, width: 1220, qty: 2 }),
    ]);
    project.headcutLeft = 100; // 유효 2340×1220, 부품 2개가 정확히 채움 (kerf 0)
    project.kerf = 0;
    const plan = calculatePlan(project);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.efficiencyPercent).toBeCloseTo(100, 1);
  });

  test('qty 만큼 부품이 확장 배치됨', () => {
    const project = projectWith([
      createCutPart({ id: 'p1', length: 300, width: 200, qty: 5 }),
    ]);
    const plan = calculatePlan(project);
    const placedCount = plan.sheets.reduce((n, s) => n + s.placed.length, 0);
    expect(placedCount + plan.unplaced.length).toBe(5);
    expect(plan.unplaced).toHaveLength(0);
  });
});

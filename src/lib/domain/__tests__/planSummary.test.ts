// planSummary.ts — 배치 결과의 자재/부품 합산 view-model 검증.

import { describe, expect, test } from 'vitest';
import { createCutPart, type CutPart, type CuttingPlan, type SheetLayout } from '../models';
import { planSummaryFromPlan } from '../planSummary';

/** 이름 조회 콜백 — cp_red 만 이름을 알고 나머지는 null(기본) 처리. */
const colorName = (id: string | null) => (id === 'cp_red' ? '빨강' : null);

function sheetOf(parts: CutPart[], withCutSequence = false): SheetLayout {
  return {
    stockSheetId: 's1',
    placed: parts.map((part, i) => ({ part, x: i * 100, y: 0, rotated: false })),
    sheetLength: 2440,
    sheetWidth: 1220,
    cutSequence: withCutSequence
      ? { verticalFirst: true, strips: [{ offset: 0, width: 600, length: 1220, segments: [{ offset: 0, length: 400, parts: [], trim: 0 }] }] }
      : null,
    leftovers: [],
  };
}

describe('planSummaryFromPlan', () => {
  test('빈 plan → 전부 0, 빈 목록', () => {
    const plan: CuttingPlan = { sheets: [], unplaced: [], efficiencyPercent: 0 };
    const s = planSummaryFromPlan(plan, colorName);
    expect(s.totalSheets).toBe(0);
    expect(s.totalPlacedParts).toBe(0);
    expect(s.totalUsedAreaMm2).toBe(0);
    expect(s.totalCuts).toBe(0);
    expect(s.cutsAreEstimated).toBe(false);
    expect(s.materialUsages).toEqual([]);
    expect(s.partGroups).toEqual([]);
  });

  test('같은 (label, 치수, 자재) 부품은 하나의 그룹으로 합산, qty 내림차순 정렬', () => {
    const side = createCutPart({ id: 'p1', length: 700, width: 400, qty: 1, label: '측판' });
    const top = createCutPart({ id: 'p2', length: 600, width: 400, qty: 1, label: '상판' });
    const plan: CuttingPlan = {
      sheets: [sheetOf([side, side, side, top])],
      unplaced: [],
      efficiencyPercent: 80,
    };
    const s = planSummaryFromPlan(plan, colorName);
    expect(s.totalPlacedParts).toBe(4);
    expect(s.partGroups).toHaveLength(2);
    expect(s.partGroups[0]).toMatchObject({ label: '측판', qty: 3, materialName: '기본 18T' });
    expect(s.partGroups[1]).toMatchObject({ label: '상판', qty: 1 });
  });

  test('자재 사용량 — 시트의 첫 부품 (color, thickness) 기준으로 시트 수·면적 합산', () => {
    const red = createCutPart({ id: 'p1', length: 500, width: 400, qty: 1, colorPresetId: 'cp_red' });
    const plain = createCutPart({ id: 'p2', length: 300, width: 200, qty: 1 });
    const plan: CuttingPlan = {
      sheets: [sheetOf([red]), sheetOf([red]), sheetOf([plain])],
      unplaced: [],
      efficiencyPercent: 50,
    };
    const s = planSummaryFromPlan(plan, colorName);
    expect(s.materialUsages).toHaveLength(2);
    // sheetCount 내림차순 — 빨강 자재 2장이 먼저.
    expect(s.materialUsages[0]).toMatchObject({ id: 'cp_red|18|', name: '빨강 18T', sheetCount: 2, usedAreaMm2: 2 * 500 * 400 });
    expect(s.materialUsages[1]).toMatchObject({ id: '|18|', name: '기본 18T', sheetCount: 1, usedAreaMm2: 300 * 200 });
    expect(s.totalUsedAreaMm2).toBe(2 * 500 * 400 + 300 * 200);
  });

  test('부품별 원장 자재 — stockMaterialId 별로 분리 집계하고 이름에 자재명 표기', () => {
    const std = createCutPart({ id: 'p1', length: 500, width: 400, qty: 1 });
    const big = createCutPart({ id: 'p2', length: 500, width: 400, qty: 1, stockMaterialId: 'sm_4x10' });
    const plan: CuttingPlan = {
      sheets: [sheetOf([std]), sheetOf([big])],
      unplaced: [],
      efficiencyPercent: 50,
    };
    const s = planSummaryFromPlan(plan, colorName, (id) => (id === 'sm_4x10' ? '4×10자' : null));
    expect(s.materialUsages).toHaveLength(2);
    const names = s.materialUsages.map((m) => m.name).sort();
    expect(names).toEqual(['기본 18T', '기본 18T · 4×10자']);
  });

  test('cutSequence 없는 시트가 하나라도 있으면 cutsAreEstimated=true', () => {
    const part = createCutPart({ id: 'p1', length: 500, width: 400, qty: 1 });
    const withSeq: CuttingPlan = { sheets: [sheetOf([part], true)], unplaced: [], efficiencyPercent: 10 };
    const withoutSeq: CuttingPlan = { sheets: [sheetOf([part], true), sheetOf([part], false)], unplaced: [], efficiencyPercent: 10 };
    expect(planSummaryFromPlan(withSeq, colorName).cutsAreEstimated).toBe(false);
    expect(planSummaryFromPlan(withoutSeq, colorName).cutsAreEstimated).toBe(true);
  });

  test('totalCuts — cutSequence 가 있으면 strip+segment 정확값을 합산', () => {
    const part = createCutPart({ id: 'p1', length: 500, width: 400, qty: 1 });
    const plan: CuttingPlan = { sheets: [sheetOf([part], true)], unplaced: [], efficiencyPercent: 10 };
    // strips 1 + segments 1 = 2
    expect(planSummaryFromPlan(plan, colorName).totalCuts).toBe(2);
  });

  test('efficiencyPercent 는 plan 값을 그대로 노출', () => {
    const plan: CuttingPlan = { sheets: [], unplaced: [], efficiencyPercent: 77.7 };
    expect(planSummaryFromPlan(plan, colorName).efficiencyPercent).toBe(77.7);
  });

  test('두께가 0 이하이면 자재 이름에 T 표기를 생략', () => {
    const noThick = createCutPart({ id: 'p1', length: 100, width: 100, qty: 1, thickness: 0 });
    const plan: CuttingPlan = { sheets: [sheetOf([noThick])], unplaced: [], efficiencyPercent: 1 };
    expect(planSummaryFromPlan(plan, colorName).materialUsages[0].name).toBe('기본');
  });
});

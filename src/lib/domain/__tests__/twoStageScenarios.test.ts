// cutmaster(Flutter) test/domain/solver/two_stage_scenarios_test.dart 포팅.
// 폭 그룹 2-stage 밴드 패킹 전략을 손계산 가능한 다양한 상황으로 검증한다.
// (실제 5038 데이터는 realScenario5038.test.ts 참조.)

import { expect, test } from 'vitest';
import { createCutPart, createStockSheet, type CuttingPlan, type GrainDirection } from '../models';
import { TreeSearchSolver } from '../treeSearchSolver';

const stock = createStockSheet({ id: 's', length: 2440, width: 1220, qty: 999 });
const solver = new TreeSearchSolver({ timeLimitMs: 2000 });

function p(id: string, l: number, w: number, q: number, g: GrainDirection = 'none') {
  return createCutPart({ id, length: l, width: w, qty: q, label: id, grainDirection: g });
}

/** 배치 유효성: 시트 경계 안 + 부품 겹침 없음. */
function expectValid(plan: CuttingPlan, sl: number, sw: number) {
  for (let si = 0; si < plan.sheets.length; si++) {
    const ps = plan.sheets[si].placed;
    for (const pp of ps) {
      const l = pp.rotated ? pp.part.width : pp.part.length;
      const w = pp.rotated ? pp.part.length : pp.part.width;
      expect(pp.x >= -0.01 && pp.x + l <= sl + 0.01, `시트${si + 1}: x 경계 초과 ${pp.part.label}`).toBe(true);
      expect(pp.y >= -0.01 && pp.y + w <= sw + 0.01, `시트${si + 1}: y 경계 초과 ${pp.part.label}`).toBe(true);
    }
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const al = a.rotated ? a.part.width : a.part.length;
        const aw = a.rotated ? a.part.length : a.part.width;
        const bl = b.rotated ? b.part.width : b.part.length;
        const bw = b.rotated ? b.part.length : b.part.width;
        const overlap =
          a.x < b.x + bl - 0.01 && a.x + al > b.x + 0.01 && a.y < b.y + bw - 0.01 && a.y + aw > b.y + 0.01;
        expect(overlap, `시트${si + 1}: 겹침 ${a.part.label}/${b.part.label}`).toBe(false);
      }
    }
  }
}

test('상황1: 두 길이 완전 조합 (1600+800, 폭 300 공유) → 1시트', () => {
  // 폭 300 공유. 밴드 [1600,800]=2400≤2440. 4밴드 × (1220/300=4) → 1시트.
  const plan = solver.solve({
    stocks: [stock],
    parts: [p('A', 1600, 300, 4), p('B', 800, 300, 4)],
    kerf: 0,
    grainLocked: false,
  });
  expect(plan.unplaced).toHaveLength(0);
  expect(plan.sheets, '8부품이 1시트에 완전 조합').toHaveLength(1);
  expect(plan.efficiencyPercent).toBeGreaterThanOrEqual(96);
  expectValid(plan, 2440, 1220);
});

test('상황2: 3-way 길이 조합 도어형 (1446/1082/718, 폭 396) → 2시트 최적', () => {
  // grain-free. FFD: [1446,718]×4 + [1082,1082]×2 = 6밴드 × (1220/396=3) → 2시트.
  const plan = solver.solve({
    stocks: [stock],
    parts: [p('a', 1446, 396, 4), p('b', 1082, 396, 4), p('c', 718, 396, 4)],
    kerf: 3,
    grainLocked: false,
  });
  expect(plan.unplaced).toHaveLength(0);
  expect(plan.sheets, '면적 하한 2시트에 도달').toHaveLength(2);
  expect(plan.efficiencyPercent).toBeGreaterThanOrEqual(85);
  expectValid(plan, 2440, 1220);
});

test('상황3: 결고정 도어 varied length → 한 밴드에 긴+짧은 도어 조합', () => {
  // 결 lengthwise(회전 금지). 1446+718 한 밴드에 들어가 시트 절약.
  const plan = solver.solve({
    stocks: [stock],
    parts: [p('big', 1446, 396, 6, 'lengthwise'), p('small', 718, 396, 6, 'lengthwise')],
    kerf: 3,
    grainLocked: false,
  });
  expect(plan.unplaced).toHaveLength(0);
  // 6밴드[1446,718] / 3밴드per시트 = 2시트.
  expect(plan.sheets).toHaveLength(2);
  // 결고정이라 전부 원본 방향(회전 없음).
  for (const s of plan.sheets) {
    expect(s.placed.every((pp) => !pp.rotated)).toBe(true);
  }
  expectValid(plan, 2440, 1220);
});

test('상황4: 작은 밴드(전면밴드형)가 남는 높이에 통합 → 시트 절약', () => {
  // 큰 패널 폭 380 + 얇은 밴드 폭 60. 3×380=1140, +60 밴드 = 1200 ≤1220(kerf0).
  const plan = solver.solve({
    stocks: [stock],
    parts: [p('panel', 1200, 380, 6), p('band', 1200, 60, 4)],
    kerf: 0,
    grainLocked: false,
  });
  expect(plan.unplaced).toHaveLength(0);
  // panel 6개: 3밴드. band 4개: 2밴드. 시트당 380×3+60=1200 → 2시트 이내.
  expect(plan.sheets.length).toBeLessThanOrEqual(2);
  expectValid(plan, 2440, 1220);
});

test('상황5: 불규칙 서로 다른 폭들 → 안전망으로 전량 배치(크래시/미배치 없음)', () => {
  const plan = solver.solve({
    stocks: [stock],
    parts: [p('x', 600, 517, 3), p('y', 1234, 289, 2), p('z', 733, 911, 2), p('w', 450, 450, 5)],
    kerf: 3,
    grainLocked: false,
  });
  expect(plan.unplaced, '불규칙 입력도 전량 배치').toHaveLength(0);
  expectValid(plan, 2440, 1220);
});

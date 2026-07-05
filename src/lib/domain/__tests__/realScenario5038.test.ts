// cutmaster(Flutter) test/domain/solver/real_scenario_5038_test.dart 포팅.
//
// 실제 파일 `5038_컷마스터_20260704`의 부품표를 그대로 재현한 측정 하네스.
// 자재별 그룹핑을 흉내 내 그룹마다 솔버를 돌리고 시트 수/효율을 집계한다.
// 목적: 알고리즘 개선의 baseline·목표를 수치로 고정한다.
//  - 현재(개선 전): 총 30시트, 효율 64.2%.
//  - 이론적 하한(면적)/기하 최적: 18T=9, 23T=4, 3T=8, LT=5 → 총 26시트.

import { expect, test } from 'vitest';
import { createCutPart, createStockSheet, type CuttingPlan, type GrainDirection } from '../models';
import { TreeSearchSolver } from '../treeSearchSolver';

const sheetL = 2440;
const sheetW = 1220;
const kerf = 3;
const stock = createStockSheet({ id: 's', length: sheetL, width: sheetW, qty: 999 });

function p(id: string, l: number, w: number, qty: number, g: GrainDirection = 'none') {
  return createCutPart({ id, length: l, width: w, qty, label: id, grainDirection: g });
}

const groups: Record<string, ReturnType<typeof p>[]> = {
  화이트_23T: [
    p('이동선반', 760, 356, 10),
    p('고정선반A', 762, 356, 10),
    p('고정선반B', 762, 358, 10),
  ],
  화이트_18T: [
    p('우측판704', 704, 380, 5),
    p('좌측판704', 704, 380, 5),
    p('전면밴드a', 761, 80, 5),
    p('전면밴드b', 761, 80, 10),
    p('지판', 800, 381, 15),
    p('천판', 800, 401, 15),
    p('우측판1068', 1068, 380, 5),
    p('좌측판1068', 1068, 380, 5),
    p('우측판1432', 1432, 380, 5),
    p('좌측판1432', 1432, 380, 5),
  ],
  LT_18T: [
    p('우도어718', 718, 395.5, 5, 'lengthwise'),
    p('좌도어718', 718, 395.5, 5, 'lengthwise'),
    p('우도어1082', 1082, 395.5, 5, 'lengthwise'),
    p('좌도어1082', 1082, 395.5, 5, 'lengthwise'),
    p('우도어1446', 1446, 395.5, 5, 'lengthwise'),
    p('좌도어1446', 1446, 395.5, 5, 'lengthwise'),
  ],
  화이트_3T: [
    p('뒷판714', 714, 772, 5),
    p('뒷판1078', 1078, 772, 5),
    p('뒷판1442', 1442, 772, 5),
  ],
};

// 그룹별 목표 시트 수. 이 이하로 배치해야 한다.
// (3T는 free-rect 멀티-빈 패커가 8→7로 개선 — 회전 혼합 guillotine 배치.)
const targets: Record<string, number> = {
  화이트_23T: 4,
  화이트_18T: 9,
  LT_18T: 5,
  화이트_3T: 7,
};

/** 배치 유효성: 미배치 없음 + 부품 겹침 없음 + 시트 경계 안. */
function expectValid(plan: CuttingPlan, sl: number, sw: number, name: string) {
  expect(plan.unplaced, `${name}: 미배치 존재`).toHaveLength(0);
  for (let si = 0; si < plan.sheets.length; si++) {
    const ps = plan.sheets[si].placed;
    for (const pp of ps) {
      const l = pp.rotated ? pp.part.width : pp.part.length;
      const w = pp.rotated ? pp.part.length : pp.part.width;
      expect(pp.x >= -0.01 && pp.x + l <= sl + 0.01, `${name} 시트${si + 1}: x 경계 초과 ${pp.part.label}`).toBe(true);
      expect(pp.y >= -0.01 && pp.y + w <= sw + 0.01, `${name} 시트${si + 1}: y 경계 초과 ${pp.part.label}`).toBe(true);
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
        expect(overlap, `${name} 시트${si + 1}: 겹침 ${a.part.label}/${b.part.label}`).toBe(false);
      }
    }
  }
}

test('실제 5038 데이터 — 그룹별 최적 시트 수 달성 (총 ≤ 25)', () => {
  let totalSheets = 0;
  let totalUsed = 0;
  let totalArea = 0;
  const lines: string[] = ['', '===== 5038 측정 결과 ====='];
  for (const [name, parts] of Object.entries(groups)) {
    const plan = new TreeSearchSolver({ timeLimitMs: 8000 }).solve({
      stocks: [stock],
      parts,
      kerf,
      grainLocked: false,
    });
    const n = plan.sheets.length;
    totalSheets += n;
    let used = 0;
    for (const s of plan.sheets) {
      for (const pp of s.placed) used += pp.part.length * pp.part.width;
    }
    const area = n * sheetL * sheetW;
    totalUsed += used;
    totalArea += area;
    const eff = area === 0 ? 0 : (used / area) * 100;
    lines.push(`${name}: ${n}시트 (목표 ≤${targets[name]}), 효율 ${eff.toFixed(1)}%, unplaced=${plan.unplaced.length}`);
    expectValid(plan, sheetL, sheetW, name);
    expect(n, `${name}: ${n}시트 (목표 ${targets[name]})`).toBeLessThanOrEqual(targets[name]);
  }
  const totalEff = totalArea === 0 ? 0 : (totalUsed / totalArea) * 100;
  lines.push('---------------------------');
  lines.push(`총 ${totalSheets}시트, 종합 효율 ${totalEff.toFixed(1)}%`);
  console.log(lines.join('\n'));
  expect(totalSheets, '총 시트 목표 ≤25').toBeLessThanOrEqual(25);
}, 60000);

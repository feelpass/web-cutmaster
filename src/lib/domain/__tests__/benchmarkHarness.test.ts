// cutmaster(Flutter) test/domain/solver/benchmark_harness_test.dart 포팅.
//
// 다양한 부품 케이스로 솔버 성능을 측정한다(시트 수 vs 면적 하한, 효율, 유효성).
// 알고리즘 개선의 baseline·회귀 가드. 출력 표를 보고 약점을 찾는다.

import { expect, test } from 'vitest';
import { createCutPart, createStockSheet, type CuttingPlan, type GrainDirection } from '../models';
import { TreeSearchSolver } from '../treeSearchSolver';

const sl = 2440;
const sw = 1220;
const stock = createStockSheet({ id: 's', length: sl, width: sw, qty: 999 });
const kerf = 5;

function p(id: string, l: number, w: number, q: number, g: GrainDirection = 'none') {
  return createCutPart({ id, length: l, width: w, qty: q, label: id, grainDirection: g });
}

// 케이스: 이름 → 부품 리스트. (모두 단일 자재 그룹 가정.)
const cases: Record<string, ReturnType<typeof p>[]> = {
  // 1) 2도어 옷장: 큰 측판/도어(결) + 선반 + 뒷판성 큰판.
  wardrobe_2door: [
    p('측판', 1980, 580, 2, 'lengthwise'),
    p('상하판', 1160, 580, 2),
    p('고정선반', 1160, 580, 3),
    p('이동선반', 1150, 560, 4),
    p('도어', 1980, 595, 2, 'lengthwise'),
    p('걸레받이', 1160, 100, 1),
  ],
  // 2) 주방 상부장 ×6 (동일 소형 박스 대량).
  kitchen_upper_x6: [
    p('측판', 700, 320, 12),
    p('상하판', 564, 320, 12),
    p('선반', 560, 315, 6),
    p('도어', 700, 300, 12, 'lengthwise'),
  ],
  // 3) 책장: 긴 측판 2 + 균일 선반 + 큰 뒷판.
  bookshelf: [
    p('측판', 1800, 250, 2, 'lengthwise'),
    p('선반', 764, 250, 6),
    p('상하판', 764, 250, 2),
    p('뒷판', 1800, 780, 1),
  ],
  // 4) 대량 균일 (양자화 스트레스).
  uniform_600x400_x120: [p('a', 600, 400, 120)],
  // 5) 소수 치수(FFD 스트레스, 폭 안 겹침).
  prime_mixed: [p('x', 523, 337, 30), p('y', 719, 241, 20), p('z', 461, 461, 15)],
  // 6) kerf 민감(kerf 0이면 딱 4×4, kerf>0이면 깨짐).
  kerf_610x305_x48: [p('a', 610, 305, 48)],
  // 7) 엣지밴딩 긴 띠.
  edgeband_2000x80_x40: [p('band', 2000, 80, 40)],
  // 8) column-stacking 최적(서로 다른 폭 세로 쌓기가 유리) ×큰수량.
  column_stack: [p('full', 1210, 600, 8), p('mid', 800, 610, 8), p('low', 800, 400, 8)],
  // 9) 회전 유리 혼합(grain-free).
  rotation_mix: [p('tall', 400, 1100, 10), p('wide', 1100, 400, 10), p('sq', 500, 500, 12)],
  // 10) 3단 서랍장 ×4 (현실 혼합 폭).
  drawer_3x4: [
    p('측판', 720, 500, 8),
    p('상하판', 564, 500, 8),
    p('서랍전판', 580, 150, 12),
    p('서랍측판', 480, 140, 24),
    p('레일판', 564, 80, 8),
    p('구분판', 564, 480, 4),
  ],
  // 11) 아주 얇은+큰판 혼합.
  mixed_thick_thin: [p('big', 1200, 900, 6), p('med', 600, 450, 12), p('sliver', 1200, 45, 20)],
  // 12) 좁고 긴 다수(세로 strip 최적).
  narrow_long: [p('a', 2380, 180, 18), p('b', 1180, 180, 12)],
  // 13) 큰판 + 자투리에 작은판 네스팅(L자 채우기).
  L_nesting: [p('big', 2400, 800, 3), p('fillA', 800, 400, 9), p('fillB', 780, 380, 9)],
  // 14) 회전 무의미한 정사각(대량).
  squares_500_x40: [p('sq', 500, 500, 40)],
  // 15) 결고정 넓은판(회전 불가) 다수.
  grain_wide: [
    p('panelA', 1200, 600, 8, 'lengthwise'),
    p('panelB', 1200, 590, 6, 'lengthwise'),
    p('trim', 1200, 30, 12),
  ],
  // 16) 현실 대형 주문(다지오메트리 고수량).
  big_order: [
    p('측판', 2100, 550, 12, 'lengthwise'),
    p('선반', 1050, 550, 30),
    p('상하판', 1050, 550, 12),
    p('도어', 1030, 480, 24, 'lengthwise'),
    p('서랍전판', 500, 180, 20),
    p('밴드', 1050, 60, 24),
  ],
  // 17) 미세 부품 대량(rect 폭증 스트레스).
  tiny_x180: [p('t1', 300, 200, 100), p('t2', 250, 250, 80)],
};

// 특성화 회귀 가드: 각 케이스의 현재 시트 수를 상한으로 고정한다.
// (≤ 이므로 개선은 허용, 퇴행은 포착.)
const maxSheets: Record<string, number> = {
  wardrobe_2door: 5,
  kitchen_upper_x6: 4,
  bookshelf: 2,
  uniform_600x400_x120: 10,
  prime_mixed: 5,
  kerf_610x305_x48: 5,
  edgeband_2000x80_x40: 3,
  column_stack: 5,
  rotation_mix: 5,
  drawer_3x4: 4,
  mixed_thick_thin: 5,
  narrow_long: 4,
  L_nesting: 4,
  squares_500_x40: 5,
  grain_wide: 4,
  big_order: 23,
  tiny_x180: 5,
};

/** 배치 유효성: 시트 경계 안 + 부품 겹침 없음. */
function expectValid(plan: CuttingPlan, sheetLen: number, sheetWid: number, name: string) {
  for (let si = 0; si < plan.sheets.length; si++) {
    const ps = plan.sheets[si].placed;
    for (const pp of ps) {
      const l = pp.rotated ? pp.part.width : pp.part.length;
      const w = pp.rotated ? pp.part.length : pp.part.width;
      expect(pp.x >= -0.01 && pp.x + l <= sheetLen + 0.01, `${name} 시트${si + 1}: x 경계 ${pp.part.label}`).toBe(true);
      expect(pp.y >= -0.01 && pp.y + w <= sheetWid + 0.01, `${name} 시트${si + 1}: y 경계 ${pp.part.label}`).toBe(true);
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

test('BENCHMARK: 다양한 케이스 시트 수/효율/하한대비', () => {
  const lines: string[] = ['', `===== SOLVER BENCHMARK (kerf=${kerf}) =====`];
  lines.push('case                        sheets  LB  over  eff%');
  lines.push('-------------------------------------------------------');
  let totalOver = 0;
  for (const [name, parts] of Object.entries(cases)) {
    const plan = new TreeSearchSolver({ timeLimitMs: 2000 }).solve({
      stocks: [stock],
      parts,
      kerf,
      grainLocked: false,
    });
    expectValid(plan, sl, sw, name);
    expect(plan.unplaced, `${name} 미배치`).toHaveLength(0);
    let used = 0;
    for (const s of plan.sheets) {
      for (const pp of s.placed) used += pp.part.length * pp.part.width;
    }
    const n = plan.sheets.length;
    const partArea = parts.reduce((acc, c) => acc + c.length * c.width * c.qty, 0);
    const lb = Math.ceil(partArea / (sl * sw));
    const over = n - lb;
    totalOver += over;
    const eff = ((used / (n * sl * sw)) * 100).toFixed(1);
    lines.push(
      name.padEnd(28) + String(n).padStart(4) + String(lb).padStart(5) + String(over).padStart(5) + eff.padStart(7),
    );
    const cap = maxSheets[name];
    if (cap != null) {
      expect(n, `${name} 배치 퇴행: ${n}시트 (상한 ${cap})`).toBeLessThanOrEqual(cap);
    }
  }
  lines.push('-------------------------------------------------------');
  lines.push(`총 over-LB(하한 초과 시트 합) = ${totalOver}  (참고: 약한 하한)`);
  console.log(lines.join('\n'));
}, 120000);

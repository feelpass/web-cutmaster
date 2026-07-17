// cutmaster(Flutter) test/domain/solver/*.dart 테스트 포팅.
// 원본과 동일한 케이스로 알고리즘 동작 동일성을 검증한다.

import { describe, expect, test } from 'vitest';
import { createCutPart, createStockSheet, drawLength, drawWidth, type PlacedPart } from '../models';
import { TreeSearchSolver } from '../treeSearchSolver';

const solver = new TreeSearchSolver();

/** 배치된 부품들이 서로 겹치지 않는지 검증. */
function expectNoOverlap(placed: PlacedPart[]) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const ax2 = a.x + drawLength(a);
      const ay2 = a.y + drawWidth(a);
      const bx2 = b.x + drawLength(b);
      const by2 = b.y + drawWidth(b);
      const overlap = a.x < bx2 && b.x < ax2 && a.y < by2 && b.y < ay2;
      expect(overlap, `부품 ${i} 와 ${j} 가 겹침`).toBe(false);
    }
  }
}

/** 모든 부품이 시트 경계 안에 있는지 검증. */
function expectWithinBounds(placed: PlacedPart[], sheetLength: number, sheetWidth: number) {
  for (const p of placed) {
    expect(p.x + drawLength(p)).toBeLessThanOrEqual(sheetLength + 0.001);
    expect(p.y + drawWidth(p)).toBeLessThanOrEqual(sheetWidth + 0.001);
  }
}

describe('TreeSearchSolver — walking skeleton (2-stage, best-first)', () => {
  test('자재 1개 + 부품 4개(2x2 정확히 들어감) → 전부 배치, 효율 95%+', () => {
    const stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 })];
    const parts = [createCutPart({ id: 'p1', length: 1200, width: 600, qty: 4, label: 'A' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0].placed).toHaveLength(4);
    expect(plan.efficiencyPercent).toBeGreaterThanOrEqual(95);
  });

  test('배치 결과는 staged guillotine — cutSequence가 채워지고 부품이 겹치지 않음', () => {
    const stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 })];
    const parts = [createCutPart({ id: 'p1', length: 1200, width: 600, qty: 4, label: 'A' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.sheets).toHaveLength(1);
    const sheet = plan.sheets[0];
    expect(sheet.cutSequence).not.toBeNull();
    expectNoOverlap(sheet.placed);
    expectWithinBounds(sheet.placed, 2440, 1220);
  });

  test('빈 자재: stocks=[] → unplaced=parts 전체', () => {
    const parts = [createCutPart({ id: 'p1', length: 100, width: 100, qty: 3 })];
    const plan = solver.solve({ stocks: [], parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced).toHaveLength(3);
    expect(plan.sheets).toHaveLength(0);
    expect(plan.efficiencyPercent).toBe(0);
  });

  test('빈 부품: parts=[] → 빈 결과', () => {
    const stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 })];
    const plan = solver.solve({ stocks, parts: [], kerf: 0, grainLocked: false });
    expect(plan.sheets).toHaveLength(0);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.efficiencyPercent).toBe(0);
  });
});

describe('TreeSearchSolver — 회전 / 결방향', () => {
  // 시트 1000(L)×2000(W). 부품 1800×400은 회전해야만 strip을 열 수 있다.
  const stocks = [createStockSheet({ id: 's1', length: 1000, width: 2000, qty: 1 })];

  test('grainLocked=false: 회전해야만 들어가는 부품 → 회전으로 전부 배치', () => {
    const parts = [createCutPart({ id: 'p1', length: 1800, width: 400, qty: 2, label: 'A' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0].placed.every((p) => p.rotated)).toBe(true);
  });

  test('grainLocked=true: 회전 금지 → 정방향 불가 부품은 unplaced', () => {
    const parts = [createCutPart({ id: 'p1', length: 1800, width: 400, qty: 2, label: 'A' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: true });
    expect(plan.unplaced).toHaveLength(2);
    expect(plan.sheets).toHaveLength(0);
  });

  test('grainDirection=widthwise: grainLocked=false여도 강제 회전', () => {
    const parts = [
      createCutPart({ id: 'p1', length: 1800, width: 400, qty: 1, grainDirection: 'widthwise' }),
    ];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0].placed[0].rotated).toBe(true);
  });

  test('grainDirection=lengthwise: 회전 금지 → 정방향 불가면 unplaced', () => {
    const parts = [
      createCutPart({ id: 'p1', length: 1800, width: 400, qty: 1, grainDirection: 'lengthwise' }),
    ];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced).toHaveLength(1);
  });
});

describe('TreeSearchSolver — 3-stage (segment 내부 가로 배치)', () => {
  test('한 띠에 부품 2개가 옆으로 들어가야 전부 배치 — 2-stage로는 불가', () => {
    const stocks = [createStockSheet({ id: 's1', length: 1000, width: 500, qty: 1 })];
    const parts = [
      createCutPart({ id: 'p1', length: 1000, width: 250, qty: 1, label: 'A' }),
      createCutPart({ id: 'p2', length: 600, width: 250, qty: 1, label: 'B' }),
      createCutPart({ id: 'p3', length: 400, width: 250, qty: 1, label: 'C' }),
    ];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: false });
    expect(plan.unplaced, '3-stage면 P2+P3가 같은 띠에 옆으로 배치되어 전부 들어감').toHaveLength(0);
    expect(plan.sheets[0].placed).toHaveLength(3);
    expect(plan.efficiencyPercent).toBeGreaterThanOrEqual(99);
    expectNoOverlap(plan.sheets[0].placed);
    expectWithinBounds(plan.sheets[0].placed, 1000, 500);
  });
});

describe('TreeSearchSolver — strip 균등 충전', () => {
  const stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 999 })];

  test('동일 부품 27개 → 1시트에 전부 (strip마다 3개씩 꽉 채움)', () => {
    const parts = [createCutPart({ id: 'p1', length: 263, width: 339, qty: 27, label: '고정선반' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: true });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets, '27개는 한 시트에 다 들어가야 함 (9 strip × 3)').toHaveLength(1);
  });

  test('동일 부품 24개 → strip마다 3개씩 꽉 (부분 충전 strip 없음)', () => {
    const parts = [createCutPart({ id: 'p1', length: 263, width: 339, qty: 24, label: '고정선반' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: true });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    // 조각화 억제: 부분 충전(꽉 안 찬) strip은 최대 1개여야 한다. 절단 방향
    // (vertical/horizontal)에 무관하게 "덜 찬 strip이 여럿 흩어지지 않음"을 검증.
    const counts = plan.sheets[0].cutSequence!.strips.map((s) => s.segments.length);
    const full = counts.reduce((m, c) => (c > m ? c : m), 0);
    const partial = counts.filter((c) => c < full).length;
    expect(partial, `strip별 부품 수 ${counts} — 부분충전 strip ${partial}개(조각화)`).toBeLessThanOrEqual(1);
  });

  test('동일 부품 60개 → 각 시트의 부분충전 strip 최대 1개 (조각화 억제)', () => {
    const parts = [createCutPart({ id: 'p1', length: 263, width: 339, qty: 60, label: '고정선반' })];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: true });
    expect(plan.unplaced).toHaveLength(0);
    for (let i = 0; i < plan.sheets.length; i++) {
      const counts = plan.sheets[i].cutSequence!.strips.map((s) => s.segments.length);
      const partial = counts.filter((c) => c < 3).length;
      expect(partial, `시트 ${i} counts=${counts}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('TreeSearchSolver — rescue (자투리 활용)', () => {
  test('작은 부품이 앞 strip 위 자투리에 들어가 시트 절약', () => {
    const stocks = [createStockSheet({ id: 's1', length: 1000, width: 1000, qty: 999 })];
    const parts = [
      createCutPart({ id: 'a', length: 500, width: 900, qty: 2, label: 'A' }),
      createCutPart({ id: 'b', length: 500, width: 100, qty: 2, label: 'B' }),
    ];
    const plan = solver.solve({ stocks, parts, kerf: 0, grainLocked: true });
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets, 'A 2 strip + 각 위 B 1개 = 1시트. rescue 없으면 2시트').toHaveLength(1);
    expect(plan.efficiencyPercent).toBeGreaterThanOrEqual(99);
  });
});

describe('TreeSearchSolver — 방향 일관성 (orientation)', () => {
  test('grain-free 부품은 고수율 방향으로 일관 배치된다 (263×339)', () => {
    const stock = createStockSheet({
      id: 's', length: 2434, width: 1211, qty: 999, label: '23T',
    });
    const parts = [
      createCutPart({
        id: 'a', length: 263, width: 339, qty: 45, label: '고정선반', thickness: 23,
      }),
    ];

    const plan = solver.solve({ stocks: [stock], parts, kerf: 3, grainLocked: false });
    expect(plan.unplaced).toHaveLength(0);

    const countOrientations = (placedList: PlacedPart[], len: number, wid: number) => {
      let o = 0;
      let r = 0;
      for (const p of placedList) {
        if (p.part.length === len && p.part.width === wid) {
          if (p.rotated) r++;
          else o++;
        }
      }
      return { original: o, rotated: r };
    };

    for (let i = 0; i < plan.sheets.length; i++) {
      const c = countOrientations(plan.sheets[i].placed, 263, 339);
      const total = c.original + c.rotated;
      if (total === 0) continue;
      expect(
        c.original === 0 || c.rotated === 0,
        `시트 ${i + 1}: 동일 부품 방향 혼재 (정${c.original}/회${c.rotated})`,
      ).toBe(true);
    }

    // 첫(가득 찬) 시트는 고수율 회전 방향으로 28개가 담겨야 한다.
    const fullest = plan.sheets
      .map((s) => countOrientations(s.placed, 263, 339))
      .reduce((a, b) => (a.original + a.rotated >= b.original + b.rotated ? a : b));
    expect(fullest.rotated, `가장 찬 시트 정${fullest.original}/회${fullest.rotated}`).toBe(28);
  });
});

describe('TreeSearchSolver — grain 혼재 통일 (grain mix)', () => {
  test('grain-locked 형제가 있으면 free 부품도 같은 방향으로 통일 + 순수 시트', () => {
    const stock = createStockSheet({ id: 's', length: 2434, width: 1211, qty: 999 });

    const mixedGrain = (l: number, w: number, label: string) => [
      createCutPart({ id: `${l}-none`, length: l, width: w, qty: 40, label, grainDirection: 'none' }),
      createCutPart({ id: `${l}-lw`, length: l, width: w, qty: 5, label, grainDirection: 'lengthwise' }),
    ];

    const parts = [...mixedGrain(763, 339, '고정선반'), ...mixedGrain(263, 339, '고정선반')];

    const plan = solver.solve({ stocks: [stock], parts, kerf: 3, grainLocked: false });
    expect(plan.unplaced).toHaveLength(0);

    for (let i = 0; i < plan.sheets.length; i++) {
      const s = plan.sheets[i];
      const geoOri = new Map<string, Set<boolean>>();
      const geoSet = new Set<string>();
      for (const p of s.placed) {
        const k = `${Math.trunc(p.part.length)}x${Math.trunc(p.part.width)}`;
        geoSet.add(k);
        let set = geoOri.get(k);
        if (!set) {
          set = new Set();
          geoOri.set(k, set);
        }
        set.add(p.rotated);
      }
      expect(geoSet.size, `시트 ${i + 1} 종류 혼합: ${[...geoSet]}`).toBeLessThanOrEqual(1);
      for (const [k, v] of geoOri) {
        expect(v.size, `시트 ${i + 1} ${k} 방향 혼재`).toBe(1);
      }
    }

    // 763 시트(순수)는 9개씩 꽉 차야 한다 (구멍 없음).
    for (const s of plan.sheets) {
      const only763 = s.placed.every((p) => p.part.length === 763);
      const has763 = s.placed.some((p) => p.part.length === 763);
      if (has763 && only763) {
        expect(s.placed.length, '763 순수 시트는 9개여야 함').toBe(9);
      }
    }
  });
});

describe('TreeSearchSolver — free-rect 슬라이스 재배열 (회전 부품 오른쪽 정렬)', () => {
  test('측판 1000×390 ×20 → 3시트, 회전 부품은 각 시트 맨 오른쪽 기둥', () => {
    const stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 999 })];
    const parts = [createCutPart({ id: 'p1', length: 1000, width: 390, qty: 20, label: '측판' })];
    const plan = solver.solve({ stocks, parts, kerf: 3, grainLocked: false });

    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets, '면적 하한 = 3시트 (7+7+6)').toHaveLength(3);

    for (let i = 0; i < plan.sheets.length; i++) {
      const s = plan.sheets[i];
      expectNoOverlap(s.placed);
      expectWithinBounds(s.placed, 2440, 1220);
      // 회전(세로) 부품은 모든 정방향 부품보다 오른쪽에 있어야 한다.
      const maxNormalEnd = Math.max(
        ...s.placed.filter((p) => !p.rotated).map((p) => p.x + drawLength(p)),
      );
      for (const p of s.placed.filter((p) => p.rotated)) {
        expect(p.x, `시트 ${i + 1}: 회전 부품이 정방향 기둥들 사이에 끼어 있음`)
          .toBeGreaterThanOrEqual(maxNormalEnd);
      }
    }
  });
});

describe('TreeSearchSolver — 2-stage strip 재배열 (소수 방향 오른쪽 정렬)', () => {
  test('600×400 ×13 (2745×1220) → 가로로 눕힌 부품 strip이 맨 오른쪽', () => {
    const stocks = [createStockSheet({ id: 's1', length: 2745, width: 1220, qty: 999 })];
    const parts = [createCutPart({ id: 'p1', length: 600, width: 400, qty: 13, label: 'P' })];
    const plan = solver.solve({ stocks, parts, kerf: 3, grainLocked: false });

    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets).toHaveLength(1);
    const s = plan.sheets[0];
    expect(s.cutSequence, '2-stage 해 (strip-cut)').not.toBeNull();
    expectNoOverlap(s.placed);
    expectWithinBounds(s.placed, 2745, 1220);

    // 세로(회전) 10개 + 가로 눕힘 3개 혼합 배치.
    const landscape = s.placed.filter((p) => drawLength(p) > drawWidth(p));
    const portrait = s.placed.filter((p) => drawLength(p) < drawWidth(p));
    expect(portrait).toHaveLength(10);
    expect(landscape).toHaveLength(3);

    // 소수 방향(가로 눕힘) 부품은 모든 세로 기둥보다 오른쪽에 있어야 한다.
    const maxPortraitEnd = Math.max(...portrait.map((p) => p.x + drawLength(p)));
    for (const p of landscape) {
      expect(p.x, '가로 눕힘 부품이 세로 기둥들 사이에 끼어 있음').toBeGreaterThanOrEqual(
        maxPortraitEnd,
      );
    }

    // cutSequence의 strip 순서도 좌표와 일치 — 마지막 strip이 가로 부품 strip(폭 600).
    const strips = s.cutSequence!.strips;
    expect(strips[strips.length - 1].width).toBe(600);
    for (let i = 1; i < strips.length; i++) {
      expect(strips[i].offset).toBeGreaterThan(strips[i - 1].offset);
    }
  });
});

describe('TreeSearchSolver — 순수 시트 (tidiness)', () => {
  test('효율이 같으면 부품 종류를 시트에 섞지 않는다 (763/263 분리)', () => {
    const stock = createStockSheet({ id: 's', length: 2434, width: 1211, qty: 999, label: '23T' });
    const parts = [
      createCutPart({ id: 'a', length: 263, width: 339, qty: 45, label: '고정선반', thickness: 23 }),
      createCutPart({ id: 'b', length: 763, width: 339, qty: 45, label: '고정선반', thickness: 23 }),
    ];

    // 넉넉한 시간으로 탐색해도 혼합 해로 넘어가지 않아야 한다.
    const plan = new TreeSearchSolver({ timeLimitMs: 3000 }).solve({
      stocks: [stock], parts, kerf: 3, grainLocked: false,
    });

    expect(plan.unplaced).toHaveLength(0);
    expect(plan.sheets, '최적은 7시트').toHaveLength(7);

    for (let i = 0; i < plan.sheets.length; i++) {
      const geos = new Set<string>();
      for (const p of plan.sheets[i].placed) {
        geos.add(`${Math.trunc(p.part.length)}x${Math.trunc(p.part.width)}`);
      }
      expect(geos.size, `시트 ${i + 1}에 부품 종류 혼합: ${[...geos]}`).toBeLessThanOrEqual(1);
    }
  });
});

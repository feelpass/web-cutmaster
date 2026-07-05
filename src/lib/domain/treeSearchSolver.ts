// cutmaster(Flutter) lib/domain/solver/tree_search_solver.dart 의 TypeScript 포팅.
// 탐색 구조·guide·tiebreaker·rescue 후처리를 원본과 동일하게 유지한다.

import type {
  CutPart,
  CutSequence,
  CuttingPlan,
  LeftoverRect,
  PlacedPart,
  Segment,
  SheetLayout,
  StockSheet,
  Strip,
} from './models';

/** 부품 단위 배치 허용 방향 (grain/lock 규칙). */
function allowedOrientations(
  part: CutPart,
  grainLocked: boolean,
): { allowOriginal: boolean; allowRotated: boolean } {
  switch (part.grainDirection) {
    case 'lengthwise':
      return { allowOriginal: true, allowRotated: false };
    case 'widthwise':
      return { allowOriginal: false, allowRotated: true };
    case 'none':
      return { allowOriginal: true, allowRotated: !grainLocked };
  }
}

interface SegState {
  /** 띠 시작 좌표 (secondary → y). */
  yOffset: number;
  /** 띠 높이 (secondary) = 이 띠를 연 부품의 secondary. */
  height: number;
  /** 마지막 부품의 primary 끝 (절대좌표 x). 다음 3rd-level은 xEnd + kerf 부터. */
  xEnd: number;
  placed: PlacedPart[];
}

/** 1st-level strip — primary축(x)의 한 구간. 내부에 띠(segment)를 y로 쌓는다. */
interface StripState {
  /** primary 시작 좌표 (vertical-first → x). */
  offset: number;
  /** strip 폭 = 이 strip을 연 부품의 primary(length). */
  width: number;
  /** 마지막 띠의 secondary 끝 (다음 띠는 segEnd + kerf 부터). */
  segEnd: number;
  segments: SegState[];
}

interface SheetState {
  stock: StockSheet;
  strips: StripState[];
}

/** 불변 탐색 노드. 열린 시트들 + 다음 처리할 부품 인덱스 + 미배치 부품. */
interface Node {
  sheets: SheetState[];
  partIdx: number;
  stockIdx: number; // 다음 새 시트로 쓸 stockQueue 인덱스.
  unplaced: CutPart[];
}

// === Node 전이 (원본 _Node 메서드들) ===

/** (1) 3rd-level: 마지막 strip의 마지막 띠에 부품을 옆으로(x 방향) 추가. */
function addThirdLevel(node: Node, part: CutPart, xOffset: number, pl: number, rotated: boolean): Node {
  const sheet = node.sheets[node.sheets.length - 1];
  const strip = sheet.strips[sheet.strips.length - 1];
  const seg = strip.segments[strip.segments.length - 1];
  const placedPart: PlacedPart = { part, x: xOffset, y: seg.yOffset, rotated };
  const newSeg: SegState = {
    yOffset: seg.yOffset,
    height: seg.height,
    xEnd: xOffset + pl,
    placed: [...seg.placed, placedPart],
  };
  const newStrip: StripState = {
    offset: strip.offset,
    width: strip.width,
    segEnd: strip.segEnd,
    segments: [...strip.segments.slice(0, -1), newSeg],
  };
  return replaceLastStrip(node, newStrip);
}

/** (2) 2nd-level: 마지막 strip에 새 띠를 y 방향으로 쌓는다. */
function addSegmentToLastStrip(
  node: Node, part: CutPart, segOffset: number, pl: number, pw: number, rotated: boolean,
): Node {
  const sheet = node.sheets[node.sheets.length - 1];
  const strip = sheet.strips[sheet.strips.length - 1];
  const placedPart: PlacedPart = { part, x: strip.offset, y: segOffset, rotated };
  const newSeg: SegState = {
    yOffset: segOffset,
    height: pw,
    xEnd: strip.offset + pl,
    placed: [placedPart],
  };
  const newStrip: StripState = {
    offset: strip.offset,
    width: strip.width,
    segEnd: segOffset + pw,
    segments: [...strip.segments, newSeg],
  };
  return replaceLastStrip(node, newStrip);
}

/** (3) 1st-level: 마지막 시트에 새 strip을 연다 (첫 띠와 함께). */
function openStripInLastSheet(
  node: Node, part: CutPart, stripOffset: number, pl: number, pw: number, rotated: boolean,
): Node {
  const sheet = node.sheets[node.sheets.length - 1];
  const placedPart: PlacedPart = { part, x: stripOffset, y: 0, rotated };
  const newStrip: StripState = {
    offset: stripOffset,
    width: pl,
    segEnd: pw,
    segments: [{ yOffset: 0, height: pw, xEnd: stripOffset + pl, placed: [placedPart] }],
  };
  const newSheet: SheetState = { stock: sheet.stock, strips: [...sheet.strips, newStrip] };
  return replaceLastSheet(node, newSheet);
}

/** (4) 새 시트를 연다 (첫 strip·첫 띠와 함께). */
function openNewSheet(
  node: Node, stock: StockSheet, part: CutPart, pl: number, pw: number, rotated: boolean,
): Node {
  const placedPart: PlacedPart = { part, x: 0, y: 0, rotated };
  const newSheet: SheetState = {
    stock,
    strips: [
      {
        offset: 0,
        width: pl,
        segEnd: pw,
        segments: [{ yOffset: 0, height: pw, xEnd: pl, placed: [placedPart] }],
      },
    ],
  };
  return {
    sheets: [...node.sheets, newSheet],
    partIdx: node.partIdx + 1,
    stockIdx: node.stockIdx + 1,
    unplaced: node.unplaced,
  };
}

/** (5) skip — 이 부품을 미배치로. */
function skipPart(node: Node, part: CutPart): Node {
  return {
    sheets: node.sheets,
    partIdx: node.partIdx + 1,
    stockIdx: node.stockIdx,
    unplaced: [...node.unplaced, part],
  };
}

function replaceLastStrip(node: Node, newStrip: StripState): Node {
  const sheet = node.sheets[node.sheets.length - 1];
  const newSheet: SheetState = {
    stock: sheet.stock,
    strips: [...sheet.strips.slice(0, -1), newStrip],
  };
  return replaceLastSheet(node, newSheet);
}

function replaceLastSheet(node: Node, newSheet: SheetState): Node {
  return {
    sheets: [...node.sheets.slice(0, -1), newSheet],
    partIdx: node.partIdx + 1,
    stockIdx: node.stockIdx,
    unplaced: node.unplaced,
  };
}

// === rescue 후처리용 가변 구조 ===

interface MutSeg {
  yOffset: number;
  height: number;
  xEnd: number;
  placed: PlacedPart[];
}

interface MutStrip {
  offset: number;
  width: number;
  segEnd: number;
  segs: MutSeg[];
}

interface MutSheet {
  stock: StockSheet;
  strips: MutStrip[];
}

export interface TreeSearchSolverOptions {
  /** 탐색 데드라인(ms). 도달하면 그때까지의 best 반환 (anytime). */
  timeLimitMs?: number;
  /** restart 빔 폭 D의 상한. */
  queueLimit?: number;
}

/**
 * 멀티 전략 guillotine 솔버. 자재 그룹당 시트 수를 최소화한다.
 *
 * **전략 1 — 폭 그룹 2-stage 밴드 패킹 (주력, [twoStageCandidates]).**
 * 부품을 "밴드 높이(=폭)"별로 묶어 길이를 시트 길이에 FFD로 채워 **밴드**(가로
 * 스트립)를 만들고(1st 수평 풀컷), 그 밴드들을 시트 폭에 FFD로 채워 시트를 만든다
 * (2nd 밴드 내 수직컷). 가구 부품처럼 폭을 공유하는 입력에서 "긴 도어+짧은 도어 한
 * 밴드"·"측판 사이 채우기" 같은 조합을 자연히 만들어 최적(면적 하한)에 도달한다.
 * tight(고밀도·홀 채우기)·tidy(지오메트리별 순수 시트) 2종을 만들어 [planBetter]로
 * 고른다 — 혼합이 시트를 줄이면 tight, 동률이면 tidy(구멍/혼합 없는 깔끔한 배치).
 *
 * **전략 2 — 멀티-빈 free-rectangle 패킹 ([freeRectCandidates]).**
 * 각 시트를 자유 사각형으로 관리하고 부품을 **모든 시트의** 최적 사각형에 넣어
 * guillotine 분할한다. 서로 다른 폭 부품을 세로로 쌓고 앞 시트 구멍을 가로질러
 * 채운다 — shelf 패킹이 못 하는 배치. 정렬·분할·적합 규칙을 여러 조합으로 돌린다.
 *
 * **전략 3 — best-first 탐색 (안전망, [solveBestFirst]).**
 * PackingSolver(arXiv:2004.02603) 스타일 3-stage(vertical-first) MBA*+restart.
 * 2-stage가 전량 배치 완전해를 내면 짧은 정제 패스로만 돌린다.
 *
 * **선택.** 모든 후보를 [planBetter]로 비교. 면적 하한에 도달하면 증명적 최적으로
 * 즉시 반환. 2-stage를 먼저 담아 동률 시 tidiness·cutSequence 있는 해를 우선한다.
 */
export class TreeSearchSolver {
  private readonly timeLimitMs: number;
  private readonly queueLimit: number;

  constructor(options: TreeSearchSolverOptions = {}) {
    this.timeLimitMs = options.timeLimitMs ?? 8000;
    this.queueLimit = options.queueLimit ?? 200;
  }

  solve(input: {
    stocks: StockSheet[];
    parts: CutPart[];
    kerf: number;
    grainLocked: boolean;
  }): CuttingPlan {
    const { stocks, parts, kerf, grainLocked } = input;

    const expanded: CutPart[] = [];
    for (const p of parts) {
      for (let i = 0; i < p.qty; i++) expanded.push(p);
    }
    if (expanded.length === 0) {
      return { sheets: [], unplaced: [], efficiencyPercent: 0 };
    }

    const stockQueue: StockSheet[] = [];
    for (const s of stocks) {
      for (let i = 0; i < s.qty; i++) stockQueue.push(s);
    }
    if (stockQueue.length === 0) {
      return { sheets: [], unplaced: [...expanded], efficiencyPercent: 0 };
    }

    const deadline = Date.now() + this.timeLimitMs;

    // === 멀티 전략 ===
    // 폭/길이 기준 2-stage 밴드 패킹(거의 즉시)으로 후보를 만들고, 증명적 최적
    // (면적 하한 도달)이 아니면 best-first 탐색을 안전망으로 돌려 최선을 고른다.
    const candidates: CuttingPlan[] = [];
    // 2-stage 먼저 추가 → tidiness·cutSequence 있는 해가 동률 시 우선(planBetter는
    // strict, 동률이면 먼저 담긴 후보 유지).
    candidates.push(...twoStageCandidates(expanded, stockQueue, kerf, grainLocked, false));
    candidates.push(...twoStageCandidates(expanded, stockQueue, kerf, grainLocked, true));
    // 멀티-빈 free-rect 패커 — 서로 다른 폭 세로 쌓기·앞 시트 홀 채우기(2-stage·
    // best-first가 못 하는 배치). 불규칙 입력에서 시트를 더 줄인다.
    candidates.push(...freeRectCandidates(expanded, stockQueue, kerf, grainLocked));

    let best: CuttingPlan | null = null;
    for (const c of candidates) {
      if (best == null || planBetter(c, best)) best = c;
    }

    // 면적 하한: 전량 배치 + 하한 시트 수 도달이면 더 못 줄이므로 즉시 반환.
    const sheetArea = stockQueue[0].length * stockQueue[0].width;
    let partArea = 0;
    for (const p of expanded) partArea += p.length * p.width;
    const lb = sheetArea === 0 ? 0 : Math.ceil(partArea / sheetArea);
    const provablyOptimal =
      best != null && best.unplaced.length === 0 && best.sheets.length <= lb;

    if (!provablyOptimal) {
      // 2-stage가 전량 배치 완전해를 냈으면 best-first는 불규칙 입력 대비 짧은
      // 정제 패스로 충분(무의미한 full-budget 낭비 방지). 실패했으면 full-budget.
      const feasibleTwoStage = best != null && best.unplaced.length === 0;
      const cap = Date.now() + 3000;
      const bfDeadline = feasibleTwoStage && cap < deadline ? cap : deadline;
      const bf = solveBestFirst(expanded, stockQueue, kerf, grainLocked, bfDeadline, this.queueLimit);
      if (best == null || planBetter(bf, best)) best = bf;
    }
    // best는 이 지점에서 항상 non-null: provablyOptimal이면 위에서 non-null,
    // 아니면 best-first가 반드시 non-null plan을 대입.
    return best!;
  }
}

/** 기존 best-first(MBA* + restart) 탐색. 불규칙 입력 안전망. */
function solveBestFirst(
  partsIn: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
  deadline: number,
  queueLimit: number,
): CuttingPlan {
  // 면적 내림차순 — 큰 부품을 먼저 배치하면 분기 효율 ↑. (탐색 처리 순서)
  const expanded = [...partsIn].sort((a, b) => b.length * b.width - a.length * a.width);
  const root: Node = { sheets: [], partIdx: 0, stockIdx: 0, unplaced: [] };

  // 지오메트리별 선호 방향(grain-locked 형제 고려) 선계산.
  const geoPref = geometryOrientation(expanded, stockQueue, kerf, grainLocked);

  // 그리디 warm-start — strip을 꽉 채우는 하한 해.
  let best: Node | null = greedy(expanded, stockQueue, kerf, grainLocked, geoPref);

  // MBA*(Memory Bounded A*) + restart. 빔 폭 D를 ×1.5로 키우며 재탐색 (anytime).
  let d = 2;
  while (Date.now() < deadline) {
    const open: Node[] = [root];
    let exhausted = true;
    while (open.length > 0) {
      if (Date.now() > deadline) {
        exhausted = false;
        break;
      }
      const node = popBest(open);
      if (node.partIdx >= expanded.length) {
        if (best == null || better(node, best)) best = node;
        continue;
      }
      open.push(...expand(node, expanded, stockQueue, kerf, grainLocked));
      if (open.length > d) trimTo(open, d);
    }
    if (!exhausted) break; // deadline 도달.
    if (d >= queueLimit) break; // 최대 빔으로 전부 탐색.
    d = Math.floor((d * 3) / 2);
    if (d > queueLimit) d = queueLimit;
  }

  let result = best ?? root;
  result = rescue(result, kerf, grainLocked);
  return materialize(result);
}

/** 노드에서 다음 부품을 배치하는 자식 노드들을 생성. */
function expand(
  node: Node,
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
): Node[] {
  const part = parts[node.partIdx];
  const allow = allowedOrientations(part, grainLocked);
  const children: Node[] = [];

  for (const rotated of [false, true]) {
    if (rotated && !allow.allowRotated) continue;
    if (!rotated && !allow.allowOriginal) continue;
    // primary(=strip 폭·띠 안 x 길이) / secondary(=띠 높이, y 축).
    const pl = rotated ? part.width : part.length;
    const pw = rotated ? part.length : part.width;

    if (node.sheets.length > 0) {
      const sheet = node.sheets[node.sheets.length - 1];
      if (sheet.strips.length > 0) {
        const strip = sheet.strips[sheet.strips.length - 1];

        // (1) 3rd-level: 마지막 띠 안에 옆으로 (x 방향).
        if (strip.segments.length > 0) {
          const seg = strip.segments[strip.segments.length - 1];
          const xOffset = seg.xEnd + kerf;
          if (pw <= seg.height && xOffset + pl <= strip.offset + strip.width) {
            children.push(addThirdLevel(node, part, xOffset, pl, rotated));
          }
        }

        // (2) 2nd-level: strip에 새 띠 (y 방향으로 쌓기).
        const segOffset = strip.segEnd === 0 ? 0 : strip.segEnd + kerf;
        if (pl <= strip.width && segOffset + pw <= sheet.stock.width) {
          children.push(addSegmentToLastStrip(node, part, segOffset, pl, pw, rotated));
        }
      }

      // (3) 1st-level: 시트에 새 strip.
      const stripOffset = sheet.strips.length === 0
        ? 0
        : sheet.strips[sheet.strips.length - 1].offset + sheet.strips[sheet.strips.length - 1].width + kerf;
      if (stripOffset + pl <= sheet.stock.length && pw <= sheet.stock.width) {
        children.push(openStripInLastSheet(node, part, stripOffset, pl, pw, rotated));
      }
    }

    // (4) 새 시트 열기.
    if (node.stockIdx < stockQueue.length) {
      const stock = stockQueue[node.stockIdx];
      if (pl <= stock.length && pw <= stock.width) {
        children.push(openNewSheet(node, stock, part, pl, pw, rotated));
      }
    }
  }

  // (5) skip — 이 부품을 미배치로 두고 다음 부품으로.
  children.push(skipPart(node, part));

  return children;
}

/** 그리디에서 시도할 방향 순서 — 지오메트리별 선호 방향을 먼저. */
function orientationOrder(
  part: CutPart,
  geoPref: Map<string, boolean>,
  allow: { allowOriginal: boolean; allowRotated: boolean },
): boolean[] {
  if (!allow.allowRotated) return [false];
  if (!allow.allowOriginal) return [true];
  const preferRotated = geoPref.get(`${part.length}x${part.width}`) ?? false;
  return preferRotated ? [true, false] : [false, true];
}

/**
 * 지오메트리(length×width)별 선호 방향(회전 여부)을 미리 계산한다.
 * grain-locked 형제가 있으면 free 부품도 그 방향으로 통일하고,
 * 제약이 없으면 빈 시트에 더 많이 담기는(고수율) 방향을 택한다.
 */
function geometryOrientation(
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
): Map<string, boolean> {
  const info = new Map<string, { l: number; w: number; forceOrig: boolean; forceRot: boolean }>();
  for (const p of parts) {
    const key = `${p.length}x${p.width}`;
    const cur = info.get(key);
    info.set(key, {
      l: p.length,
      w: p.width,
      forceOrig: (cur?.forceOrig ?? false) || p.grainDirection === 'lengthwise',
      forceRot: (cur?.forceRot ?? false) || p.grainDirection === 'widthwise',
    });
  }
  const stock = stockQueue.length > 0 ? stockQueue[0] : null;
  const pref = new Map<string, boolean>();
  for (const [key, v] of info) {
    if (v.forceOrig && !v.forceRot) {
      pref.set(key, false); // 원본으로 통일
    } else if (v.forceRot && !v.forceOrig) {
      pref.set(key, true); // 회전으로 통일
    } else if (grainLocked || stock == null) {
      pref.set(key, false);
    } else {
      const orig = copiesPerSheet(v.l, v.w, stock, kerf);
      const rot = copiesPerSheet(v.w, v.l, stock, kerf);
      pref.set(key, rot > orig);
    }
  }
  return pref;
}

/** 빈 시트에 (x=pl, y=pw) 방향으로 담기는 부품 개수 (guillotine grid 근사). */
function copiesPerSheet(pl: number, pw: number, s: StockSheet, kerf: number): number {
  if (pl > s.length || pw > s.width) return 0;
  const cols = Math.floor((s.length + kerf) / (pl + kerf));
  const rows = Math.floor((s.width + kerf) / (pw + kerf));
  return cols * rows;
}

/** 그리디 하한 해 — 마지막 strip 채우기 우선(3rd → 2nd → 1st → 새 시트). */
function greedy(
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
  geoPref: Map<string, boolean>,
): Node {
  let node: Node = { sheets: [], partIdx: 0, stockIdx: 0, unplaced: [] };
  for (const part of parts) {
    const allow = allowedOrientations(part, grainLocked);
    const order = orientationOrder(part, geoPref, allow);
    let next: Node | null = null;
    for (const rotated of order) {
      const pl = rotated ? part.width : part.length;
      const pw = rotated ? part.length : part.width;

      if (node.sheets.length > 0) {
        const sheet = node.sheets[node.sheets.length - 1];
        if (sheet.strips.length > 0) {
          const strip = sheet.strips[sheet.strips.length - 1];
          // 3rd-level
          if (strip.segments.length > 0) {
            const seg = strip.segments[strip.segments.length - 1];
            const xOffset = seg.xEnd + kerf;
            if (pw <= seg.height && xOffset + pl <= strip.offset + strip.width) {
              next = addThirdLevel(node, part, xOffset, pl, rotated);
              break;
            }
          }
          // 2nd-level
          const segOffset = strip.segEnd === 0 ? 0 : strip.segEnd + kerf;
          if (pl <= strip.width && segOffset + pw <= sheet.stock.width) {
            next = addSegmentToLastStrip(node, part, segOffset, pl, pw, rotated);
            break;
          }
        }
        // 1st-level
        const stripOffset = sheet.strips.length === 0
          ? 0
          : sheet.strips[sheet.strips.length - 1].offset + sheet.strips[sheet.strips.length - 1].width + kerf;
        if (stripOffset + pl <= sheet.stock.length && pw <= sheet.stock.width) {
          next = openStripInLastSheet(node, part, stripOffset, pl, pw, rotated);
          break;
        }
      }
      // 새 시트
      if (node.stockIdx < stockQueue.length) {
        const stock = stockQueue[node.stockIdx];
        if (pl <= stock.length && pw <= stock.width) {
          next = openNewSheet(node, stock, part, pl, pw, rotated);
          break;
        }
      }
    }
    node = next ?? skipPart(node, part);
  }
  return node;
}

/** 미배치 1개의 guide 페널티 (면적 단위) — 어떤 닫힌 낭비보다 크게. */
const UNPLACED_PENALTY = 1e9;

/** best-first guide — 낮을수록 우선. 확정 낭비 + 미배치 페널티. */
function guide(n: Node): number {
  return committedWaste(n) + n.unplaced.length * UNPLACED_PENALTY;
}

/** 다시 채울 수 없는 닫힌 영역의 합. 열린(마지막) 시트·strip·띠는 제외. */
function committedWaste(n: Node): number {
  if (n.sheets.length === 0) return 0;
  let waste = 0;
  for (let si = 0; si < n.sheets.length; si++) {
    const s = n.sheets[si];
    const isLastSheet = si === n.sheets.length - 1;
    for (let ti = 0; ti < s.strips.length; ti++) {
      const st = s.strips[ti];
      const isLastStrip = isLastSheet && ti === s.strips.length - 1;
      // 띠 우측 trim — 마지막 strip의 마지막 띠는 옆으로 더 채울 수 있어 제외.
      for (let gi = 0; gi < st.segments.length; gi++) {
        const seg = st.segments[gi];
        const isLastSeg = isLastStrip && gi === st.segments.length - 1;
        if (!isLastSeg) {
          waste += (st.offset + st.width - seg.xEnd) * seg.height;
        }
      }
      // strip 위쪽(다음 띠) 빈 공간 — 마지막 strip은 더 쌓을 수 있어 제외.
      if (!isLastStrip) {
        waste += st.width * (s.stock.width - st.segEnd);
      }
    }
    // 시트 우측(다음 strip) 빈 공간 — 마지막 시트는 더 열 수 있어 제외.
    if (!isLastSheet && s.strips.length > 0) {
      const last = s.strips[s.strips.length - 1];
      const usedPrimary = last.offset + last.width;
      waste += (s.stock.length - usedPrimary) * s.stock.width;
    }
  }
  return waste;
}

/**
 * 완전해 비교: 미배치 적은 쪽 → 효율 높은 쪽 → 방향 혼재 적은 쪽
 * → 부품 종류 혼재(혼합 시트) 적은 쪽 → 조각화 적은 쪽 → 시트 적은 쪽.
 */
function better(a: Node, b: Node): boolean {
  if (a.unplaced.length !== b.unplaced.length) {
    return a.unplaced.length < b.unplaced.length;
  }
  const ta = totalArea(a);
  const tb = totalArea(b);
  const ea = ta === 0 ? 0 : usedArea(a) / ta;
  const eb = tb === 0 ? 0 : usedArea(b) / tb;
  if (Math.abs(ea - eb) > 0.0001) return ea > eb;
  const ma = orientationMixing(a);
  const mb = orientationMixing(b);
  if (ma !== mb) return ma < mb;
  const sa = sheetTypeMixing(a);
  const sb = sheetTypeMixing(b);
  if (sa !== sb) return sa < sb;
  const wa = committedWaste(a);
  const wb = committedWaste(b);
  if (Math.abs(wa - wb) > 1.0) return wa < wb;
  return a.sheets.length < b.sheets.length;
}

/** 서로 다른 지오메트리(length×width) 부품이 한 시트에 섞인 시트 수. */
function sheetTypeMixing(n: Node): number {
  let mixed = 0;
  for (const s of n.sheets) {
    let first: string | null = null;
    let isMixed = false;
    for (const st of s.strips) {
      for (const seg of st.segments) {
        for (const p of seg.placed) {
          const k = `${p.part.length}x${p.part.width}`;
          if (first == null) first = k;
          if (k !== first) {
            isMixed = true;
            break;
          }
        }
        if (isMixed) break;
      }
      if (isMixed) break;
    }
    if (isMixed) mixed++;
  }
  return mixed;
}

/**
 * 동일 지오메트리 부품이 서로 다른 방향으로 섞인 정도.
 * 지오메트리별 소수(minority) 방향 개수의 합 — 0이면 완전 일관.
 */
function orientationMixing(n: Node): number {
  const orig = new Map<string, number>();
  const rot = new Map<string, number>();
  for (const s of n.sheets) {
    for (const st of s.strips) {
      for (const seg of st.segments) {
        for (const p of seg.placed) {
          const k = `${p.part.length}x${p.part.width}`;
          if (p.rotated) {
            rot.set(k, (rot.get(k) ?? 0) + 1);
          } else {
            orig.set(k, (orig.get(k) ?? 0) + 1);
          }
        }
      }
    }
  }
  let mixing = 0;
  const keys = new Set([...orig.keys(), ...rot.keys()]);
  for (const k of keys) {
    const o = orig.get(k) ?? 0;
    const r = rot.get(k) ?? 0;
    mixing += Math.min(o, r);
  }
  return mixing;
}

function totalArea(n: Node): number {
  let total = 0;
  for (const s of n.sheets) total += s.stock.length * s.stock.width;
  return total;
}

function usedArea(n: Node): number {
  let used = 0;
  for (const s of n.sheets) {
    for (const st of s.strips) {
      for (const seg of st.segments) {
        for (const p of seg.placed) {
          used += p.part.length * p.part.width;
        }
      }
    }
  }
  return used;
}

/**
 * open 리스트에서 best 노드를 꺼낸다(제거 후 반환).
 * 1차 키: guide(확정 낭비) 최소. 2차 키(동점): 더 많이 채운(used 큰) 노드 우선.
 */
function popBest(open: Node[]): Node {
  let bestIdx = 0;
  let bestW = guide(open[0]);
  let bestU = usedArea(open[0]);
  for (let i = 1; i < open.length; i++) {
    const w = guide(open[i]);
    if (w < bestW - 0.001) {
      bestW = w;
      bestU = usedArea(open[i]);
      bestIdx = i;
    } else if (w <= bestW + 0.001) {
      const u = usedArea(open[i]);
      if (u > bestU) {
        bestW = w;
        bestU = u;
        bestIdx = i;
      }
    }
  }
  return open.splice(bestIdx, 1)[0];
}

/** 큐가 limit을 넘으면 나쁜 노드들을 버려 그 크기로 줄인다. */
function trimTo(open: Node[], limit: number): void {
  open.sort((a, b) => {
    const ga = guide(a);
    const gb = guide(b);
    if (Math.abs(ga - gb) > 0.001) return ga - gb;
    return usedArea(b) - usedArea(a);
  });
  open.length = limit;
}

// === rescue 후처리 ===

function toMut(s: SheetState): MutSheet {
  return {
    stock: s.stock,
    strips: s.strips.map((st) => ({
      offset: st.offset,
      width: st.width,
      segEnd: st.segEnd,
      segs: st.segments.map((seg) => ({
        yOffset: seg.yOffset,
        height: seg.height,
        xEnd: seg.xEnd,
        placed: [...seg.placed],
      })),
    })),
  };
}

function copyMut(m: MutSheet): MutSheet {
  return {
    stock: m.stock,
    strips: m.strips.map((st) => ({
      offset: st.offset,
      width: st.width,
      segEnd: st.segEnd,
      segs: st.segs.map((seg) => ({
        yOffset: seg.yOffset,
        height: seg.height,
        xEnd: seg.xEnd,
        placed: [...seg.placed],
      })),
    })),
  };
}

function toState(m: MutSheet): SheetState {
  return {
    stock: m.stock,
    strips: m.strips.map((st) => ({
      offset: st.offset,
      width: st.width,
      segEnd: st.segEnd,
      segments: st.segs.map((seg) => ({
        yOffset: seg.yOffset,
        height: seg.height,
        xEnd: seg.xEnd,
        placed: [...seg.placed],
      })),
    })),
  };
}

/**
 * post-process rescue — 마지막 시트부터 비우기를 시도한다. 그 시트의 부품을
 * 앞 시트들의 guillotine 유효 자투리에 전부 재배치할 수 있으면 시트를 제거.
 */
function rescue(node: Node, kerf: number, grainLocked: boolean): Node {
  if (node.sheets.length < 2) return node;
  const sheets = node.sheets.map(toMut);

  for (let v = sheets.length - 1; v >= 1; v--) {
    const victimParts: CutPart[] = [];
    for (const st of sheets[v].strips) {
      for (const seg of st.segs) {
        for (const p of seg.placed) {
          victimParts.push(p.part);
        }
      }
    }
    // 큰 부품부터 — 자투리에 큰 것을 먼저 끼운다.
    victimParts.sort((a, b) => b.length * b.width - a.length * a.width);

    // 앞 시트들(0..v-1) 복사본에 전부 들어가는지 시도.
    const trial: MutSheet[] = [];
    for (let i = 0; i < v; i++) trial.push(copyMut(sheets[i]));
    let ok = true;
    for (const part of victimParts) {
      if (!placeInScraps(trial, part, kerf, grainLocked)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (let i = 0; i < v; i++) sheets[i] = trial[i];
      sheets.splice(v, 1);
    }
  }

  return {
    sheets: sheets.map(toState),
    partIdx: node.partIdx,
    stockIdx: node.stockIdx,
    unplaced: node.unplaced,
  };
}

/**
 * 부품을 trial 시트들의 자투리에 first-fit으로 배치(성공 시 trial 수정).
 * 띠 우측 trim(3rd-level)을 먼저, 안 되면 strip 위 빈 띠(2nd-level)를 시도한다.
 */
function placeInScraps(trial: MutSheet[], part: CutPart, kerf: number, grainLocked: boolean): boolean {
  const allow = allowedOrientations(part, grainLocked);
  for (const sheet of trial) {
    for (const strip of sheet.strips) {
      for (const rotated of [false, true]) {
        if (rotated && !allow.allowRotated) continue;
        if (!rotated && !allow.allowOriginal) continue;
        const pl = rotated ? part.width : part.length;
        const pw = rotated ? part.length : part.width;

        // 띠 우측 trim (3rd-level).
        for (const seg of strip.segs) {
          const xOff = seg.xEnd + kerf;
          if (pw <= seg.height && xOff + pl <= strip.offset + strip.width) {
            seg.placed.push({ part, x: xOff, y: seg.yOffset, rotated });
            seg.xEnd = xOff + pl;
            return true;
          }
        }
        // strip 위 빈 띠 (2nd-level).
        const segOff = strip.segEnd === 0 ? 0 : strip.segEnd + kerf;
        if (pl <= strip.width && segOff + pw <= sheet.stock.width) {
          strip.segs.push({
            yOffset: segOff,
            height: pw,
            xEnd: strip.offset + pl,
            placed: [{ part, x: strip.offset, y: segOff, rotated }],
          });
          strip.segEnd = segOff + pw;
          return true;
        }
      }
    }
  }
  return false;
}

function materialize(node: Node): CuttingPlan {
  const layouts: SheetLayout[] = [];
  let totalArea = 0;
  let usedArea = 0;
  for (const s of node.sheets) {
    if (s.strips.length === 0) continue;
    const placed: PlacedPart[] = [];
    const strips: Strip[] = [];
    for (const st of s.strips) {
      const segments: Segment[] = [];
      for (const seg of st.segments) {
        placed.push(...seg.placed);
        // 띠 안 부품들이 쓴 x 길이 끝 → 우측 trim.
        const trim = st.offset + st.width - seg.xEnd;
        segments.push({
          offset: seg.yOffset,
          length: seg.height,
          parts: seg.placed,
          trim: trim < 0 ? 0 : trim,
        });
      }
      strips.push({
        offset: st.offset,
        width: st.width,
        length: s.stock.width,
        segments,
      });
    }
    const cutSequence: CutSequence = { verticalFirst: true, strips };
    layouts.push({
      stockSheetId: s.stock.id,
      placed,
      sheetLength: s.stock.length,
      sheetWidth: s.stock.width,
      cutSequence,
      leftovers: [],
    });
    totalArea += s.stock.length * s.stock.width;
    for (const p of placed) {
      usedArea += p.part.length * p.part.width;
    }
  }
  const efficiency = totalArea === 0 ? 0 : (usedArea / totalArea) * 100;
  return {
    sheets: layouts,
    unplaced: [...node.unplaced],
    efficiencyPercent: efficiency,
  };
}

// ===========================================================================
// 전략: 폭 그룹 기반 2-stage 밴드 패킹 (horizontal-first guillotine)
// ===========================================================================
//
// 부품을 "밴드 높이(=폭)"별로 묶어 길이를 stock.length에 FFD로 채워 **밴드**를
// 만들고(1st cut = 수평 풀컷), 그 밴드들의 높이를 stock.width에 FFD로 채워
// **시트**를 만든다(2nd cut = 밴드 내 수직 컷). 가구 부품처럼 폭을 공유하는
// 입력(도어·선반·측판 등)에서 vertical-first 단일 strip 탐색이 못 만드는
// "1446도어+718도어 한 밴드" 같은 조합을 자연히 만들어 시트 수를 최소화한다.
//
// rotateAll=true면 모든 부품을 90° 회전(밴드 높이=길이)해 시도한다.
// 결방향이 해당 방향을 불허하는 부품이 하나라도 있으면 [] (이 전략 불가).

/** 2-stage 밴드 패킹용: 한 부품 단위(방향 확정). */
interface Unit {
  part: CutPart;
  bandLen: number; // 밴드 안 x 길이.
  bandHeight: number; // 밴드 높이(=y, 폭).
  rot: boolean;
}

/** 밴드 안의 한 항목 (부품 + x 오프셋). */
interface BandItem {
  unit: Unit;
  x: number;
}

/** 하나의 밴드(가로 스트립). 같은 높이 부품들이 x로 나열됨. */
interface Band {
  height: number;
  items: BandItem[];
  usedLen: number;
}

/** 담긴 부품 지오메트리 시그니처(정렬) — 시트 패킹 tidy 정렬용. */
function bandGeoKey(band: Band): string {
  return band.items
    .map((i) => `${i.unit.part.length}x${i.unit.part.width}`)
    .sort()
    .join(',');
}

/**
 * 지배(최대) 부품 지오메트리 — items는 길이 내림차순이라 첫 항목이 최대.
 * tidy 분할 키: 같은 지배 지오메트리 밴드끼리 같은 시트에 모은다.
 */
function bandDomGeoKey(band: Band): string {
  const it = band.items[0].unit.part;
  return `${it.length}x${it.width}`;
}

/** 시트에 배치된 밴드 (밴드 + y 오프셋). */
interface PlacedBand {
  band: Band;
  y: number;
}

/** 2-stage 패킹 중인 시트. */
interface PackSheet {
  bands: PlacedBand[];
  usedHeight: number;
}

/**
 * 한 방향(rotateAll)으로 밴드를 만들고, 시트 배치 2가지(tight·tidy)로 후보 plan을
 * 만든다. 결방향 위배·미장착이면 빈 리스트.
 *  - tight: 밀도 우선(꽉 찬 밴드 먼저) → 홀 채우기·고밀도. 혼합 시트 허용.
 *  - tidy : 지오메트리별 순수 시트(다른 종류 안 섞음). 효율 동률일 때 선호.
 */
function twoStageCandidates(
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
  rotateAll: boolean,
): CuttingPlan[] {
  const stock = stockQueue[0];
  const maxSheets = stockQueue.length;

  // 1) 방향 결정 + 밴드 높이(=폭)별 그룹핑.
  const byHeight = new Map<number, Unit[]>();
  for (const part of parts) {
    const allow = allowedOrientations(part, grainLocked);
    let rot: boolean;
    if (rotateAll) {
      if (!allow.allowRotated) return [];
      rot = true;
    } else {
      if (!allow.allowOriginal) return [];
      rot = false;
    }
    const bandLen = rot ? part.width : part.length;
    const bandHeight = rot ? part.length : part.width;
    if (bandLen > stock.length + 1e-6 || bandHeight > stock.width + 1e-6) {
      return []; // 이 방향으론 시트에 안 들어감 → 전략 불가.
    }
    let arr = byHeight.get(bandHeight);
    if (!arr) {
      arr = [];
      byHeight.set(bandHeight, arr);
    }
    arr.push({ part, bandLen, bandHeight, rot });
  }

  // 2) 각 높이 그룹: 길이를 stock.length에 FFD → 밴드.
  const bands: Band[] = [];
  for (const [height, units] of byHeight) {
    units.sort((a, b) => b.bandLen - a.bandLen);
    const bins = ffd(units.map((u) => u.bandLen), stock.length, kerf);
    for (const bin of bins) {
      const band: Band = { height, items: [], usedLen: 0 };
      let x = 0;
      for (const idx of bin) {
        const u = units[idx];
        if (band.items.length > 0) x += kerf;
        band.items.push({ unit: u, x });
        x += u.bandLen;
      }
      band.usedLen = x;
      bands.push(band);
    }
  }

  return [
    packBands(bands, stock, kerf, maxSheets, false),
    packBands(bands, stock, kerf, maxSheets, true),
  ];
}

/** sortDense — (높이↓, 채움길이↓, 지오메트리) 순. 꽉 찬 밴드를 먼저. */
function sortDenseBands(bs: Band[]): Band[] {
  return [...bs].sort((a, b) => {
    const c = b.height - a.height;
    if (c !== 0) return c;
    const u = b.usedLen - a.usedLen; // 꽉 찬 밴드 먼저.
    if (u !== 0) return u;
    const ka = bandGeoKey(a);
    const kb = bandGeoKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * 밴드들을 시트에 배치.
 *  - tidy=false(tight): 전 밴드를 sortDense 순으로 FFD. 꽉 찬 밴드를 먼저 깔아
 *    고밀도. 남는 높이에 작은 밴드를 끼워 시트 최소화.
 *  - tidy=true: 지배 지오메트리별로 분할해 각 그룹을 **독립된 시트 집합**에 FFD →
 *    시트가 한 종류만 담아 순수(구멍/혼합 없음).
 */
function packBands(
  bandsIn: Band[],
  stock: StockSheet,
  kerf: number,
  maxSheets: number,
  tidy: boolean,
): CuttingPlan {
  const sheets: PackSheet[] = [];
  const unplaced: CutPart[] = [];

  const packInto = (group: Band[]) => {
    for (const band of sortDenseBands(group)) {
      let target: PackSheet | null = null;
      for (const s of sheets) {
        const need = s.bands.length === 0 ? band.height : s.usedHeight + kerf + band.height;
        if (need <= stock.width + 1e-6) {
          target = s;
          break;
        }
      }
      if (target == null) {
        if (sheets.length >= maxSheets) {
          for (const it of band.items) unplaced.push(it.unit.part);
          continue;
        }
        target = { bands: [], usedHeight: 0 };
        sheets.push(target);
      }
      const y = target.bands.length === 0 ? 0 : target.usedHeight + kerf;
      target.bands.push({ band, y });
      target.usedHeight = y + band.height;
    }
  };

  if (!tidy) {
    packInto(bandsIn);
  } else {
    // 지배 지오메트리별 분할 → 그룹마다 새 시트(다른 그룹 시트 재사용 안 함).
    const groups = new Map<string, Band[]>();
    for (const b of bandsIn) {
      const k = bandDomGeoKey(b);
      let arr = groups.get(k);
      if (!arr) {
        arr = [];
        groups.set(k, arr);
      }
      arr.push(b);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      const ha = groups.get(a)![0].height;
      const hb = groups.get(b)![0].height;
      const c = hb - ha; // 높이 큰 그룹 먼저 (안정적 순서).
      if (c !== 0) return c;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    for (const k of keys) {
      packGroupFresh(groups.get(k)!, sheets, unplaced, stock, kerf, maxSheets);
    }
  }

  return materializeTwoStage(sheets, stock, unplaced);
}

/**
 * tidy 전용: 한 지오메트리 그룹을, **이미 존재하는 시트를 건드리지 않고** 새 시트에만
 * FFD로 담는다 (순수 시트 보장).
 */
function packGroupFresh(
  group: Band[],
  sheets: PackSheet[],
  unplaced: CutPart[],
  stock: StockSheet,
  kerf: number,
  maxSheets: number,
): void {
  const startIdx = sheets.length; // 이 인덱스 이후 시트만 이 그룹 소유.
  for (const band of sortDenseBands(group)) {
    let target: PackSheet | null = null;
    for (let i = startIdx; i < sheets.length; i++) {
      const s = sheets[i];
      const need = s.bands.length === 0 ? band.height : s.usedHeight + kerf + band.height;
      if (need <= stock.width + 1e-6) {
        target = s;
        break;
      }
    }
    if (target == null) {
      if (sheets.length >= maxSheets) {
        for (const it of band.items) unplaced.push(it.unit.part);
        continue;
      }
      target = { bands: [], usedHeight: 0 };
      sheets.push(target);
    }
    const y = target.bands.length === 0 ? 0 : target.usedHeight + kerf;
    target.bands.push({ band, y });
    target.usedHeight = y + band.height;
  }
}

/**
 * First-Fit-Decreasing 1D 빈 패킹. sizes는 내림차순 가정. kerf는 인접 항목 사이.
 * 반환: 각 빈이 담은 원본 인덱스 리스트.
 */
function ffd(sizes: number[], cap: number, kerf: number): number[][] {
  const bins: number[][] = [];
  const used: number[] = [];
  for (let i = 0; i < sizes.length; i++) {
    const v = sizes[i];
    let placed = false;
    for (let b = 0; b < bins.length; b++) {
      const need = bins[b].length === 0 ? v : used[b] + kerf + v;
      if (need <= cap + 1e-6) {
        bins[b].push(i);
        used[b] = need;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push([i]);
      used.push(v);
    }
  }
  return bins;
}

function materializeTwoStage(
  sheets: PackSheet[],
  stock: StockSheet,
  unplaced: CutPart[],
): CuttingPlan {
  const layouts: SheetLayout[] = [];
  let totalArea = 0;
  let usedArea = 0;
  for (const ps of sheets) {
    if (ps.bands.length === 0) continue;
    const placed: PlacedPart[] = [];
    const strips: Strip[] = [];
    const leftovers: LeftoverRect[] = [];
    for (const pb of ps.bands) {
      const band = pb.band;
      const y = pb.y;
      const segments: Segment[] = [];
      for (let i = 0; i < band.items.length; i++) {
        const it = band.items[i];
        const pp: PlacedPart = { part: it.unit.part, x: it.x, y, rotated: it.unit.rot };
        placed.push(pp);
        const isLast = i === band.items.length - 1;
        const trim = isLast ? stock.length - band.usedLen : 0;
        segments.push({
          offset: it.x,
          length: it.unit.bandLen,
          parts: [pp],
          trim: trim < 0 ? 0 : trim,
        });
      }
      strips.push({ offset: y, width: band.height, length: stock.length, segments });
      const rightW = stock.length - band.usedLen;
      if (rightW > 1 && band.height > 1) {
        leftovers.push({ x: band.usedLen, y, width: rightW, height: band.height });
      }
    }
    const topH = stock.width - ps.usedHeight;
    if (topH > 1) {
      leftovers.push({ x: 0, y: ps.usedHeight, width: stock.length, height: topH });
    }
    layouts.push({
      stockSheetId: stock.id,
      placed,
      sheetLength: stock.length,
      sheetWidth: stock.width,
      cutSequence: { verticalFirst: false, strips },
      leftovers,
    });
    totalArea += stock.length * stock.width;
    for (const p of placed) usedArea += p.part.length * p.part.width;
  }
  const eff = totalArea === 0 ? 0 : (usedArea / totalArea) * 100;
  return { sheets: layouts, unplaced: [...unplaced], efficiencyPercent: eff };
}

// === 완성해(plan) 단위 비교 — best-first의 better와 동일 위계 ===
// 미배치↓ → 효율↑(시트↓) → 방향 혼재↓ → 종류 혼재↓ → 가장 빈 시트 더 비움 → 시트↓.
function planBetter(a: CuttingPlan, b: CuttingPlan): boolean {
  if (a.unplaced.length !== b.unplaced.length) {
    return a.unplaced.length < b.unplaced.length;
  }
  if (Math.abs(a.efficiencyPercent - b.efficiencyPercent) > 0.0001) {
    return a.efficiencyPercent > b.efficiencyPercent;
  }
  const ma = planOrientationMixing(a);
  const mb = planOrientationMixing(b);
  if (ma !== mb) return ma < mb;
  const sa = planSheetTypeMixing(a);
  const sb = planSheetTypeMixing(b);
  if (sa !== sb) return sa < sb;
  // 고밀도 배치(가장 빈 시트를 더 비우는 쪽) 선호 → 고수율 방향·재활용 자투리 집중.
  const la = emptiestSheetUsed(a);
  const lb = emptiestSheetUsed(b);
  if (Math.abs(la - lb) > 1.0) return la < lb;
  return a.sheets.length < b.sheets.length;
}

function planOrientationMixing(plan: CuttingPlan): number {
  const orig = new Map<string, number>();
  const rot = new Map<string, number>();
  for (const s of plan.sheets) {
    for (const p of s.placed) {
      const k = `${p.part.length}x${p.part.width}`;
      if (p.rotated) {
        rot.set(k, (rot.get(k) ?? 0) + 1);
      } else {
        orig.set(k, (orig.get(k) ?? 0) + 1);
      }
    }
  }
  let mixing = 0;
  for (const k of new Set([...orig.keys(), ...rot.keys()])) {
    const o = orig.get(k) ?? 0;
    const r = rot.get(k) ?? 0;
    mixing += Math.min(o, r);
  }
  return mixing;
}

function planSheetTypeMixing(plan: CuttingPlan): number {
  let mixed = 0;
  for (const s of plan.sheets) {
    let first: string | null = null;
    let isMixed = false;
    for (const p of s.placed) {
      const k = `${p.part.length}x${p.part.width}`;
      if (first == null) first = k;
      if (k !== first) {
        isMixed = true;
        break;
      }
    }
    if (isMixed) mixed++;
  }
  return mixed;
}

function emptiestSheetUsed(plan: CuttingPlan): number {
  let min = Infinity;
  for (const s of plan.sheets) {
    let used = 0;
    for (const p of s.placed) used += p.part.length * p.part.width;
    if (used < min) min = used;
  }
  return min === Infinity ? 0 : min;
}

// ===========================================================================
// 전략: 멀티-빈 guillotine free-rectangle 패킹 (best-fit decreasing, multi-start)
// ===========================================================================
//
// 각 시트를 자유 사각형 리스트로 관리하고, 부품을 **모든 시트의** 자유 사각형 중
// 가장 잘 맞는 곳에 넣은 뒤 guillotine 분할(rect → 부품 + 자식 rect 2개)한다.
// → 서로 다른 폭 부품을 세로로 쌓고, 앞 시트의 구멍을 가로질러 채운다(2-stage
// shelf·best-first의 "마지막 시트" 한계를 넘음). 정렬·분할·적합 규칙을 여러 조합으로
// 돌려 목적함수로 최선을 고른다. 출력 cutSequence는 null(절단수 추정치 사용).

/** free-rect 패킹용 자유 사각형. */
interface FRRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** free-rect 패킹 중인 시트 (자유 사각형 + 배치된 부품). */
interface FRSheet {
  free: FRRect[];
  placed: PlacedPart[];
}

function freeRectCandidates(
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
): CuttingPlan[] {
  const sorts = ['area', 'maxside', 'width', 'length'];
  const splits = ['short', 'long'];
  const fits = ['baf', 'bssf'];
  const out: CuttingPlan[] = [];
  for (const s of sorts) {
    for (const sp of splits) {
      for (const ft of fits) {
        out.push(freeRectPack(parts, stockQueue, kerf, grainLocked, s, sp, ft));
      }
    }
  }
  return out;
}

function freeRectPack(
  parts: CutPart[],
  stockQueue: StockSheet[],
  kerf: number,
  grainLocked: boolean,
  sortMode: string,
  splitRule: string,
  fitRule: string,
): CuttingPlan {
  const stock = stockQueue[0];
  const maxSheets = stockQueue.length;
  let minDim = Infinity;
  for (const p of parts) {
    const m = Math.min(p.length, p.width);
    if (m < minDim) minDim = m;
  }
  const order = [...parts].sort((a, b) => frKey(b, sortMode) - frKey(a, sortMode));

  const sheets: FRSheet[] = [];
  const unplaced: CutPart[] = [];
  for (const part of order) {
    const allow = allowedOrientations(part, grainLocked);
    let bestSheet: FRSheet | null = null;
    let bestRi = -1;
    let bestRot = false;
    let bestScore = Infinity;
    let bpw = 0;
    let bph = 0;
    for (const sheet of sheets) {
      for (let ri = 0; ri < sheet.free.length; ri++) {
        const r = sheet.free[ri];
        for (const rot of [false, true]) {
          if (rot && !allow.allowRotated) continue;
          if (!rot && !allow.allowOriginal) continue;
          const pw = rot ? part.width : part.length;
          const ph = rot ? part.length : part.width;
          if (pw <= r.w + 1e-6 && ph <= r.h + 1e-6) {
            const score = frFit(r, pw, ph, fitRule);
            if (score < bestScore - 1e-9) {
              bestScore = score;
              bestSheet = sheet;
              bestRi = ri;
              bestRot = rot;
              bpw = pw;
              bph = ph;
            }
          }
        }
      }
    }
    if (bestSheet != null) {
      frPlace(bestSheet, bestRi, part, bpw, bph, bestRot, kerf, splitRule, minDim);
      continue;
    }
    // 새 시트.
    if (sheets.length >= maxSheets) {
      unplaced.push(part);
      continue;
    }
    const ns: FRSheet = { free: [{ x: 0, y: 0, w: stock.length, h: stock.width }], placed: [] };
    const r = ns.free[0];
    let placed = false;
    for (const rot of [false, true]) {
      if (rot && !allow.allowRotated) continue;
      if (!rot && !allow.allowOriginal) continue;
      const pw = rot ? part.width : part.length;
      const ph = rot ? part.length : part.width;
      if (pw <= r.w + 1e-6 && ph <= r.h + 1e-6) {
        frPlace(ns, 0, part, pw, ph, rot, kerf, splitRule, minDim);
        placed = true;
        break;
      }
    }
    if (placed) {
      sheets.push(ns);
    } else {
      unplaced.push(part);
    }
  }
  return materializeFreeRect(sheets, stock, unplaced);
}

function frKey(p: CutPart, mode: string): number {
  switch (mode) {
    case 'maxside':
      return Math.max(p.length, p.width);
    case 'width':
      return p.width;
    case 'length':
      return p.length;
    default: // area
      return p.length * p.width;
  }
}

function frFit(r: FRRect, pw: number, ph: number, rule: string): number {
  switch (rule) {
    case 'bssf': // best short-side fit
      return Math.min(r.w - pw, r.h - ph);
    default: // baf — best area fit
      return r.w * r.h - pw * ph;
  }
}

/** 부품을 rect[ri] 좌하단에 놓고 guillotine 분할해 자식 rect 2개를 남긴다. */
function frPlace(
  sheet: FRSheet,
  ri: number,
  part: CutPart,
  pw: number,
  ph: number,
  rot: boolean,
  kerf: number,
  splitRule: string,
  minDim: number,
): void {
  const r = sheet.free[ri];
  sheet.placed.push({ part, x: r.x, y: r.y, rotated: rot });
  const rightW = r.w - pw - kerf;
  const topH = r.h - ph - kerf;
  // 분할 축 선택: leftover 짧은 쪽으로 자르면(short) 넓은 조각을 온전히 남긴다.
  const horiz = r.w - pw < r.h - ph; // 가로 leftover가 더 짧은가.
  const splitHoriz = splitRule === 'short' ? horiz : !horiz;
  const children: FRRect[] = [];
  if (splitHoriz) {
    if (rightW > 1e-6) children.push({ x: r.x + pw + kerf, y: r.y, w: rightW, h: ph });
    if (topH > 1e-6) children.push({ x: r.x, y: r.y + ph + kerf, w: r.w, h: topH });
  } else {
    if (rightW > 1e-6) children.push({ x: r.x + pw + kerf, y: r.y, w: rightW, h: r.h });
    if (topH > 1e-6) children.push({ x: r.x, y: r.y + ph + kerf, w: pw, h: topH });
  }
  sheet.free.splice(ri, 1);
  for (const c of children) {
    // 어떤 부품도 못 담는 조각은 버려 rect 폭증 방지.
    if (c.w >= minDim - 1e-6 && c.h >= minDim - 1e-6) sheet.free.push(c);
  }
}

function materializeFreeRect(
  sheets: FRSheet[],
  stock: StockSheet,
  unplaced: CutPart[],
): CuttingPlan {
  const layouts: SheetLayout[] = [];
  let total = 0;
  let used = 0;
  for (const sh of sheets) {
    if (sh.placed.length === 0) continue;
    const leftovers: LeftoverRect[] = [];
    for (const r of sh.free) {
      if (r.w > 1 && r.h > 1) leftovers.push({ x: r.x, y: r.y, width: r.w, height: r.h });
    }
    layouts.push({
      stockSheetId: stock.id,
      placed: [...sh.placed],
      sheetLength: stock.length,
      sheetWidth: stock.width,
      cutSequence: null,
      leftovers,
    });
    total += stock.length * stock.width;
    for (const p of sh.placed) used += p.part.length * p.part.width;
  }
  return {
    sheets: layouts,
    unplaced: [...unplaced],
    efficiencyPercent: total === 0 ? 0 : (used / total) * 100,
  };
}

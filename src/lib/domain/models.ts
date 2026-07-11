// cutmaster(Flutter) lib/domain/models/* 의 TypeScript 포팅.
// 알고리즘·직렬화 스키마(schemaVersion 4)를 원본과 동일하게 유지한다.

/** 결방향 — 합판은 결이 있어서 회전 가능 여부가 달라짐. */
export type GrainDirection = 'none' | 'lengthwise' | 'widthwise';

export interface CutPart {
  id: string;
  length: number;
  width: number;
  qty: number;
  label: string;
  grainDirection: GrainDirection;
  colorPresetId: string | null;
  thickness: number;
  priority: number;
  /** EDGE1~4 (4면 엣지 자재). 빈 문자열은 "엣지 없음". 항상 길이 4. */
  edges: [string, string, string, string];
  fileName: string;
  groove: string;
  memo: string;
}

/**
 * 고유 id 생성. `crypto.randomUUID()`는 보안 컨텍스트(https·localhost)에서만
 * 존재해서, LAN IP(http) 같은 비보안 컨텍스트에선 undefined라 호출 시 예외가 난다.
 * (그 경우 "행 추가" 등 id를 만드는 동작이 조용히 죽는다.) 그래서 어디서나 쓸 수
 * 있는 `getRandomValues` 기반 UUID v4로 폴백한다.
 */
export function genId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c != null && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c != null && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createCutPart(p: Partial<CutPart> & { id: string; length: number; width: number; qty: number }): CutPart {
  return {
    label: '',
    grainDirection: 'none',
    colorPresetId: null,
    thickness: 18,
    priority: 1,
    edges: ['', '', '', ''],
    fileName: '',
    groove: '',
    memo: '',
    ...p,
  };
}

/** 보유 자재 (재료 시트). */
export interface StockSheet {
  id: string;
  length: number; // mm
  width: number; // mm
  qty: number;
  label: string;
  grainDirection: GrainDirection;
  colorPresetId: string | null;
}

export function createStockSheet(s: Partial<StockSheet> & { id: string; length: number; width: number; qty: number }): StockSheet {
  return { label: '', grainDirection: 'none', colorPresetId: null, ...s };
}

/** 시트 위 자유(재활용 가능) 사각형. */
export interface LeftoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedPart {
  part: CutPart;
  x: number;
  y: number;
  rotated: boolean;
}

/** 회전 시 시각화용 가로/세로. */
export function drawLength(p: PlacedPart): number {
  return p.rotated ? p.part.width : p.part.length;
}
export function drawWidth(p: PlacedPart): number {
  return p.rotated ? p.part.length : p.part.width;
}

/** strip 내부에서 stage 2 절단으로 만들어진 segment. */
export interface Segment {
  /** strip 내부에서의 시작 좌표 (verticalFirst=true이면 y). */
  offset: number;
  /** segment 길이 (절단 방향과 평행). */
  length: number;
  parts: PlacedPart[];
  /** segment 끝의 trim 자투리 길이. */
  trim: number;
}

/** stage 1 풀컷으로 만들어진 시트 위의 한 strip(기둥/띠). */
export interface Strip {
  offset: number;
  width: number;
  length: number;
  segments: Segment[];
}

/** 절단 순서 / 구조 정보. */
export interface CutSequence {
  verticalFirst: boolean;
  strips: Strip[];
}

export interface SheetLayout {
  stockSheetId: string;
  placed: PlacedPart[];
  sheetLength: number;
  sheetWidth: number;
  cutSequence: CutSequence | null;
  leftovers: LeftoverRect[];
}

/** 이 시트에서 사용된 면적 비율 (0-100). */
export function sheetUsedPercent(s: SheetLayout): number {
  if (s.sheetLength === 0 || s.sheetWidth === 0) return 0;
  const total = s.sheetLength * s.sheetWidth;
  const used = s.placed.reduce((acc, p) => acc + p.part.length * p.part.width, 0);
  return (used / total) * 100;
}

/** 솔버 결과. 시트별 배치 + 미배치 부품 + 효율. */
export interface CuttingPlan {
  sheets: SheetLayout[];
  unplaced: CutPart[];
  efficiencyPercent: number;
}

/** 시트의 절단 횟수 — strip-cut은 정확값, 아니면 라인 추정값. */
export function estimateGuillotineCuts(s: SheetLayout): number {
  const seq = s.cutSequence;
  if (seq != null) {
    let n = seq.strips.length;
    for (const strip of seq.strips) n += strip.segments.length;
    return n;
  }
  if (s.placed.length === 0) return 0;
  const xs = new Set<number>();
  const ys = new Set<number>();
  const l = Math.round(s.sheetLength);
  const w = Math.round(s.sheetWidth);
  for (const p of s.placed) {
    const x1 = Math.round(p.x);
    const y1 = Math.round(p.y);
    const x2 = Math.round(p.x + drawLength(p));
    const y2 = Math.round(p.y + drawWidth(p));
    if (x1 > 0 && x1 < l) xs.add(x1);
    if (x2 > 0 && x2 < l) xs.add(x2);
    if (y1 > 0 && y1 < w) ys.add(y1);
    if (y2 > 0 && y2 < w) ys.add(y2);
  }
  return xs.size + ys.size;
}

/** 한 번의 재단 작업 단위. 자재+부품+옵션+메타데이터 묶음. */
export interface Project {
  id: string;
  name: string;
  stocks: StockSheet[];
  parts: CutPart[];
  kerf: number; // mm — 톱날 두께
  grainLocked: boolean;
  showPartLabels: boolean;
  useSingleSheet: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  orderNumber: string;
  dueDate: string | null; // ISO
  memo: string;
  headcutTop: number;
  headcutBottom: number;
  headcutLeft: number;
  headcutRight: number;
}

/** 자동 자재 도출 시 사용되는 표준 자재 크기. */
export const STANDARD_STOCK_LENGTH = 2440;
export const STANDARD_STOCK_WIDTH = 1220;

/** On-disk JSON 스키마 버전 (원본 .cutmaster v4와 호환). */
export const PROJECT_SCHEMA_VERSION = 4;

export function createProject(id: string, name: string): Project {
  const now = new Date().toISOString();
  return {
    id,
    name,
    stocks: [],
    parts: [],
    kerf: 3,
    grainLocked: false,
    showPartLabels: true,
    useSingleSheet: false,
    createdAt: now,
    updatedAt: now,
    orderNumber: '',
    dueDate: null,
    memo: '',
    headcutTop: 0,
    headcutBottom: 0,
    headcutLeft: 0,
    headcutRight: 0,
  };
}

function materialLabel(p: CutPart): string {
  const t = Number.isInteger(p.thickness) ? String(p.thickness) : String(p.thickness);
  return `${t}T`;
}

/**
 * 부품의 (colorPresetId, thickness) 고유 조합으로 자재 시트 자동 도출.
 * 모두 표준 크기(2440×1220) 무제한 수량(qty=999)으로 생성된다.
 * 사용자가 직접 입력한 stocks가 있어도 무시하고 부품에서만 도출.
 */
export function derivedStocks(project: Project): StockSheet[] {
  const seen = new Map<string, StockSheet>();
  for (const p of project.parts) {
    const key = `${p.colorPresetId ?? ''}|${p.thickness}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      id: `auto_${key}`,
      length: STANDARD_STOCK_LENGTH,
      width: STANDARD_STOCK_WIDTH,
      qty: 999,
      label: materialLabel(p),
      grainDirection: 'none',
      colorPresetId: p.colorPresetId,
    });
  }
  return [...seen.values()];
}

// === 직렬화 (원본 .cutmaster JSON 스키마와 동일) ===

type Json = Record<string, unknown>;

export function cutPartToJson(p: CutPart): Json {
  const hasAnyEdge = p.edges.some((e) => e !== '');
  return {
    id: p.id,
    length: p.length,
    width: p.width,
    qty: p.qty,
    label: p.label,
    grain: p.grainDirection,
    ...(p.colorPresetId != null ? { colorPresetId: p.colorPresetId } : {}),
    thickness: p.thickness,
    priority: p.priority,
    ...(hasAnyEdge ? { edges: p.edges } : {}),
    ...(p.fileName !== '' ? { fileName: p.fileName } : {}),
    ...(p.groove !== '' ? { groove: p.groove } : {}),
    ...(p.memo !== '' ? { memo: p.memo } : {}),
  };
}

export function cutPartFromJson(j: Json): CutPart {
  const edgesJson = j.edges;
  const edges: [string, string, string, string] = Array.isArray(edgesJson)
    ? [0, 1, 2, 3].map((i) => (typeof edgesJson[i] === 'string' ? (edgesJson[i] as string) : '')) as [string, string, string, string]
    : ['', '', '', ''];
  return {
    id: j.id as string,
    length: j.length as number,
    width: j.width as number,
    qty: j.qty as number,
    label: (j.label as string) ?? '',
    grainDirection: ((j.grain as string) ?? 'none') as GrainDirection,
    colorPresetId: (j.colorPresetId as string | undefined) ?? null,
    thickness: (j.thickness as number | undefined) ?? 18,
    priority: (j.priority as number | undefined) ?? 1,
    edges,
    fileName: (j.fileName as string) ?? '',
    groove: (j.groove as string) ?? '',
    memo: (j.memo as string) ?? '',
  };
}

export function stockSheetToJson(s: StockSheet): Json {
  return {
    id: s.id,
    length: s.length,
    width: s.width,
    qty: s.qty,
    label: s.label,
    grain: s.grainDirection,
    ...(s.colorPresetId != null ? { colorPresetId: s.colorPresetId } : {}),
  };
}

export function stockSheetFromJson(j: Json): StockSheet {
  return {
    id: j.id as string,
    length: j.length as number,
    width: j.width as number,
    qty: j.qty as number,
    label: (j.label as string) ?? '',
    grainDirection: ((j.grain as string) ?? 'none') as GrainDirection,
    colorPresetId: (j.colorPresetId as string | undefined) ?? null,
  };
}

export function projectToJson(p: Project): Json {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: p.id,
    name: p.name,
    kerf: p.kerf,
    grainLocked: p.grainLocked,
    showPartLabels: p.showPartLabels,
    useSingleSheet: p.useSingleSheet,
    stocks: p.stocks.map(stockSheetToJson),
    parts: p.parts.map(cutPartToJson),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    orderNumber: p.orderNumber,
    ...(p.dueDate != null ? { dueDate: p.dueDate } : {}),
    memo: p.memo,
    headcutTop: p.headcutTop,
    headcutBottom: p.headcutBottom,
    headcutLeft: p.headcutLeft,
    headcutRight: p.headcutRight,
  };
}

export function projectFromJson(j: Json): Project {
  const v = (j.schemaVersion as number | undefined) ?? 1;
  if (v > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${v}`);
  }
  return {
    id: j.id as string,
    name: j.name as string,
    stocks: ((j.stocks as Json[] | undefined) ?? []).map(stockSheetFromJson),
    parts: ((j.parts as Json[] | undefined) ?? []).map(cutPartFromJson),
    kerf: (j.kerf as number | undefined) ?? 3,
    grainLocked: (j.grainLocked as boolean | undefined) ?? false,
    showPartLabels: (j.showPartLabels as boolean | undefined) ?? true,
    useSingleSheet: (j.useSingleSheet as boolean | undefined) ?? false,
    createdAt: (j.createdAt as string | undefined) ?? new Date().toISOString(),
    updatedAt: (j.updatedAt as string | undefined) ?? new Date().toISOString(),
    orderNumber: (j.orderNumber as string | undefined) ?? '',
    dueDate: typeof j.dueDate === 'string' ? j.dueDate : null,
    memo: (j.memo as string | undefined) ?? '',
    headcutTop: (j.headcutTop as number | undefined) ?? 0,
    headcutBottom: (j.headcutBottom as number | undefined) ?? 0,
    headcutLeft: (j.headcutLeft as number | undefined) ?? 0,
    headcutRight: (j.headcutRight as number | undefined) ?? 0,
  };
}

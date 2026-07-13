// models.ts — id 생성, 팩토리 기본값, 파생 지표, 자동 자재 도출,
// .cutmaster(schemaVersion 4) 직렬화 round-trip 검증.

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createCutPart,
  createProject,
  createStockSheet,
  cutPartFromJson,
  cutPartToJson,
  derivedStocks,
  drawLength,
  drawWidth,
  estimateGuillotineCuts,
  genId,
  projectFromJson,
  projectToJson,
  sheetUsedPercent,
  stockSheetFromJson,
  stockSheetToJson,
  PROJECT_SCHEMA_VERSION,
  STANDARD_STOCK_LENGTH,
  STANDARD_STOCK_WIDTH,
  type SheetLayout,
} from '../models';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('genId', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('UUID v4 형식이고 호출마다 고유', () => {
    const a = genId();
    const b = genId();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  test('randomUUID 가 없는 환경(http LAN)에서는 getRandomValues 폴백으로 v4 생성', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(genId()).toMatch(UUID_V4);
  });

  test('crypto 자체가 없어도 예외 없이 고유 id 생성', () => {
    vi.stubGlobal('crypto', undefined);
    const a = genId();
    const b = genId();
    expect(a.startsWith('id-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('팩토리 기본값', () => {
  test('createCutPart — 두께 18T, 우선순위 1, 엣지 4면 빈 문자열', () => {
    const p = createCutPart({ id: 'p1', length: 100, width: 50, qty: 2 });
    expect(p.thickness).toBe(18);
    expect(p.priority).toBe(1);
    expect(p.grainDirection).toBe('none');
    expect(p.colorPresetId).toBeNull();
    expect(p.edges).toEqual(['', '', '', '']);
    expect(p.label).toBe('');
  });

  test('createStockSheet — 결방향 none, 프리셋 없음', () => {
    const s = createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 });
    expect(s.grainDirection).toBe('none');
    expect(s.colorPresetId).toBeNull();
    expect(s.label).toBe('');
  });

  test('createProject — kerf 3, edgeMargin 30, 헤드컷 0', () => {
    const p = createProject('id1', '테스트');
    expect(p.kerf).toBe(3);
    expect(p.edgeMargin).toBe(30);
    expect(p.headcutTop + p.headcutBottom + p.headcutLeft + p.headcutRight).toBe(0);
    expect(p.dueDate).toBeNull();
    expect(p.createdAt).toBe(p.updatedAt);
  });
});

describe('drawLength / drawWidth', () => {
  const part = createCutPart({ id: 'p1', length: 300, width: 100, qty: 1 });

  test('회전 없음 — 원래 치수', () => {
    const placed = { part, x: 0, y: 0, rotated: false };
    expect(drawLength(placed)).toBe(300);
    expect(drawWidth(placed)).toBe(100);
  });

  test('회전 — 가로/세로 뒤바뀜', () => {
    const placed = { part, x: 0, y: 0, rotated: true };
    expect(drawLength(placed)).toBe(100);
    expect(drawWidth(placed)).toBe(300);
  });
});

describe('sheetUsedPercent', () => {
  test('시트 치수가 0이면 0', () => {
    const s: SheetLayout = { stockSheetId: 's', placed: [], sheetLength: 0, sheetWidth: 100, cutSequence: null, leftovers: [] };
    expect(sheetUsedPercent(s)).toBe(0);
  });

  test('배치 면적 / 시트 면적 비율(%)', () => {
    const part = createCutPart({ id: 'p1', length: 100, width: 100, qty: 1 });
    const s: SheetLayout = {
      stockSheetId: 's',
      placed: [
        { part, x: 0, y: 0, rotated: false },
        { part, x: 100, y: 0, rotated: false },
      ],
      sheetLength: 200,
      sheetWidth: 200,
      cutSequence: null,
      leftovers: [],
    };
    expect(sheetUsedPercent(s)).toBeCloseTo(50);
  });
});

describe('estimateGuillotineCuts', () => {
  test('빈 시트 → 0', () => {
    const s: SheetLayout = { stockSheetId: 's', placed: [], sheetLength: 2440, sheetWidth: 1220, cutSequence: null, leftovers: [] };
    expect(estimateGuillotineCuts(s)).toBe(0);
  });

  test('cutSequence 가 있으면 정확값 — strip 수 + segment 수', () => {
    const s: SheetLayout = {
      stockSheetId: 's',
      placed: [],
      sheetLength: 2440,
      sheetWidth: 1220,
      cutSequence: {
        verticalFirst: true,
        strips: [
          { offset: 0, width: 600, length: 1220, segments: [
            { offset: 0, length: 400, parts: [], trim: 0 },
            { offset: 400, length: 400, parts: [], trim: 0 },
          ] },
          { offset: 600, width: 600, length: 1220, segments: [
            { offset: 0, length: 400, parts: [], trim: 0 },
          ] },
        ],
      },
      leftovers: [],
    };
    // strips 2 + segments (2+1) = 5
    expect(estimateGuillotineCuts(s)).toBe(5);
  });

  test('cutSequence 가 없으면 내부 절단선 개수로 추정 (시트 가장자리는 제외)', () => {
    const part = createCutPart({ id: 'p1', length: 100, width: 100, qty: 1 });
    const s: SheetLayout = {
      stockSheetId: 's',
      placed: [
        { part, x: 0, y: 0, rotated: false },
        { part, x: 100, y: 0, rotated: false },
      ],
      sheetLength: 200,
      sheetWidth: 100,
      cutSequence: null,
      leftovers: [],
    };
    // 내부 세로선 x=100 하나뿐 (x=0/200, y=0/100 은 가장자리)
    expect(estimateGuillotineCuts(s)).toBe(1);
  });
});

describe('derivedStocks', () => {
  test('(colorPresetId, thickness) 고유 조합마다 표준 크기 자재 1개', () => {
    const project = createProject('id1', 't');
    project.parts = [
      createCutPart({ id: 'p1', length: 100, width: 50, qty: 1, thickness: 18 }),
      createCutPart({ id: 'p2', length: 200, width: 50, qty: 1, thickness: 18 }), // 같은 조합
      createCutPart({ id: 'p3', length: 100, width: 50, qty: 1, thickness: 15 }),
      createCutPart({ id: 'p4', length: 100, width: 50, qty: 1, thickness: 18, colorPresetId: 'cp_red' }),
    ];
    const stocks = derivedStocks(project);
    expect(stocks).toHaveLength(3);
    for (const s of stocks) {
      expect(s.length).toBe(STANDARD_STOCK_LENGTH);
      expect(s.width).toBe(STANDARD_STOCK_WIDTH);
      expect(s.qty).toBe(999);
      expect(s.id.startsWith('auto_')).toBe(true);
    }
    expect(stocks.map((s) => s.label)).toEqual(['18T', '15T', '18T']);
    expect(stocks[2].colorPresetId).toBe('cp_red');
  });

  test('사용자 stocks 는 무시하고 부품에서만 도출', () => {
    const project = createProject('id1', 't');
    project.stocks = [createStockSheet({ id: 'manual', length: 1000, width: 500, qty: 5 })];
    project.parts = [createCutPart({ id: 'p1', length: 100, width: 50, qty: 1 })];
    const stocks = derivedStocks(project);
    expect(stocks).toHaveLength(1);
    expect(stocks[0].id).not.toBe('manual');
  });

  test('부품이 없으면 빈 배열', () => {
    expect(derivedStocks(createProject('id1', 't'))).toEqual([]);
  });
});

describe('CutPart 직렬화', () => {
  test('round-trip — 모든 필드 보존', () => {
    const p = createCutPart({
      id: 'p1', length: 100.5, width: 50, qty: 3,
      label: '측판', grainDirection: 'lengthwise', colorPresetId: 'cp_red',
      thickness: 15, priority: 2, edges: ['E1', '', 'E1', 'E2'],
      fileName: 'door.dxf', groove: 'G4', memo: '메모',
    });
    expect(cutPartFromJson(cutPartToJson(p))).toEqual(p);
  });

  test('선택 필드는 기본값일 때 JSON 키를 생략 (데스크톱 호환)', () => {
    const p = createCutPart({ id: 'p1', length: 100, width: 50, qty: 1 });
    const j = cutPartToJson(p);
    expect('edges' in j).toBe(false);
    expect('colorPresetId' in j).toBe(false);
    expect('fileName' in j).toBe(false);
    expect('groove' in j).toBe(false);
    expect('memo' in j).toBe(false);
  });

  test('엣지가 하나라도 있으면 edges 배열을 포함', () => {
    const p = createCutPart({ id: 'p1', length: 100, width: 50, qty: 1, edges: ['E1', '', '', ''] });
    expect(cutPartToJson(p).edges).toEqual(['E1', '', '', '']);
  });

  test('레거시 최소 JSON → 기본값 채움', () => {
    const p = cutPartFromJson({ id: 'p1', length: 100, width: 50, qty: 1 });
    expect(p.label).toBe('');
    expect(p.grainDirection).toBe('none');
    expect(p.thickness).toBe(18);
    expect(p.priority).toBe(1);
    expect(p.edges).toEqual(['', '', '', '']);
  });

  test('edges 배열이 4개 미만이거나 타입이 잘못돼도 안전하게 보정', () => {
    const p = cutPartFromJson({ id: 'p1', length: 1, width: 1, qty: 1, edges: ['E1', 42] });
    expect(p.edges).toEqual(['E1', '', '', '']);
  });
});

describe('StockSheet 직렬화', () => {
  test('round-trip — 필드 보존', () => {
    const s = createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 2, label: 'PB', grainDirection: 'widthwise', colorPresetId: 'cp_oak' });
    expect(stockSheetFromJson(stockSheetToJson(s))).toEqual(s);
  });

  test('colorPresetId 가 null 이면 키 생략, 로드 시 null 복원', () => {
    const s = createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 });
    const j = stockSheetToJson(s);
    expect('colorPresetId' in j).toBe(false);
    expect(stockSheetFromJson(j).colorPresetId).toBeNull();
  });
});

describe('Project 직렬화', () => {
  function sampleProject() {
    const p = createProject('proj1', '주방장');
    p.parts = [createCutPart({ id: 'p1', length: 100, width: 50, qty: 2, edges: ['E1', '', '', ''] })];
    p.stocks = [createStockSheet({ id: 's1', length: 2440, width: 1220, qty: 1 })];
    p.kerf = 4;
    p.orderNumber = 'ORD-1';
    p.dueDate = '2026-07-20T00:00:00.000Z';
    p.memo = '납기 엄수';
    p.headcutLeft = 10;
    p.edgeMargin = 40;
    return p;
  }

  test('round-trip — 모든 필드 보존', () => {
    const p = sampleProject();
    expect(projectFromJson(projectToJson(p))).toEqual(p);
  });

  test('schemaVersion 4 를 기록', () => {
    expect(projectToJson(sampleProject()).schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });

  test('dueDate 가 null 이면 키 생략, 로드 시 null', () => {
    const p = sampleProject();
    p.dueDate = null;
    const j = projectToJson(p);
    expect('dueDate' in j).toBe(false);
    expect(projectFromJson(j).dueDate).toBeNull();
  });

  test('미래 schemaVersion 은 예외', () => {
    expect(() => projectFromJson({ schemaVersion: PROJECT_SCHEMA_VERSION + 1, id: 'x', name: 'x' })).toThrow(/Unsupported schemaVersion/);
  });

  test('구버전 최소 JSON(schemaVersion 없음) → 기본값 채움', () => {
    const p = projectFromJson({ id: 'x', name: '옛 프로젝트' });
    expect(p.kerf).toBe(3);
    expect(p.grainLocked).toBe(false);
    expect(p.showPartLabels).toBe(true);
    expect(p.stocks).toEqual([]);
    expect(p.parts).toEqual([]);
    expect(p.edgeMargin).toBe(30);
    expect(p.headcutTop).toBe(0);
  });
});

// 원장 자재(시트 규격) 카탈로그 — seed 규격 + 사용자가 자재 관리에서 추가한 커스텀 규격.
// 커스텀 규격과 기본(Default) 선택은 localStorage에 영속화한다 (colorPresets 패턴과 동일).

import { STANDARD_STOCK_LENGTH, STANDARD_STOCK_WIDTH } from './domain/models';

export interface StockMaterial {
  id: string;
  name: string;
  /** 원장 길이 (mm). */
  length: number;
  /** 원장 폭 (mm). */
  width: number;
}

const CUSTOM_KEY = 'cutmaster.customStockMaterials';
const DEFAULT_ID_KEY = 'cutmaster.defaultStockMaterialId';

/** 기본 제공 규격 — 4×8자가 Default, 4×9자/4×10자는 수입 보드용. */
export const seedStockMaterials: StockMaterial[] = [
  { id: 'sm_4x8', name: '4×8자', length: STANDARD_STOCK_LENGTH, width: STANDARD_STOCK_WIDTH },
  { id: 'sm_4x9', name: '4×9자', length: 2745, width: 1220 },
  { id: 'sm_4x10', name: '4×10자', length: 3050, width: 1220 },
];

let customMaterials: StockMaterial[] | null = null;
let defaultId: string | null = null;

function isStockMaterial(v: unknown): v is StockMaterial {
  return (
    typeof v === 'object' && v != null &&
    typeof (v as StockMaterial).id === 'string' &&
    typeof (v as StockMaterial).name === 'string' &&
    typeof (v as StockMaterial).length === 'number' &&
    typeof (v as StockMaterial).width === 'number'
  );
}

function loadCustom(): StockMaterial[] {
  if (customMaterials != null) return customMaterials;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const parsed: unknown = raw == null ? [] : JSON.parse(raw);
    customMaterials = Array.isArray(parsed) ? parsed.filter(isStockMaterial) : [];
  } catch {
    // storage 불가(SSR·사파리 시크릿 등) — 메모리에서만 유지.
    customMaterials = [];
  }
  return customMaterials;
}

function saveCustom(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customMaterials ?? []));
  } catch {
    // 영속화 실패는 무시 — 메모리에서만 유지.
  }
}

/** seed + 커스텀 전체 자재. */
export function allStockMaterials(): StockMaterial[] {
  return [...seedStockMaterials, ...loadCustom()];
}

export function stockMaterialById(id: string | null): StockMaterial | null {
  if (id == null) return null;
  return allStockMaterials().find((m) => m.id === id) ?? null;
}

export function isSeedStockMaterial(id: string): boolean {
  return seedStockMaterials.some((s) => s.id === id);
}

/** 커스텀 자재 추가. 치수는 양수여야 한다. */
export function addStockMaterial(name: string, length: number, width: number): StockMaterial {
  const created: StockMaterial = {
    id: `sm_custom_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(),
    length,
    width,
  };
  customMaterials = [...loadCustom(), created];
  saveCustom();
  return created;
}

/** 커스텀 자재 삭제 (seed는 삭제 불가). 삭제한 자재가 Default였으면 4×8자로 되돌린다. */
export function deleteStockMaterial(id: string): void {
  if (isSeedStockMaterial(id)) return;
  customMaterials = loadCustom().filter((m) => m.id !== id);
  saveCustom();
  if (loadDefaultId() === id) setDefaultStockMaterialId(seedStockMaterials[0].id);
}

function loadDefaultId(): string {
  if (defaultId != null) return defaultId;
  try {
    defaultId = localStorage.getItem(DEFAULT_ID_KEY) ?? seedStockMaterials[0].id;
  } catch {
    defaultId = seedStockMaterials[0].id;
  }
  return defaultId;
}

/** Default 자재 — 저장된 선택이 없거나 삭제됐으면 4×8자. */
export function getDefaultStockMaterial(): StockMaterial {
  return stockMaterialById(loadDefaultId()) ?? seedStockMaterials[0];
}

export function setDefaultStockMaterialId(id: string): void {
  defaultId = id;
  try {
    localStorage.setItem(DEFAULT_ID_KEY, id);
  } catch {
    // 영속화 실패는 무시 — 메모리에서만 유지.
  }
}

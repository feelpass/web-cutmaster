// cutmaster(Flutter) preset_provider + material_name_input의 자재(색상) 프리셋 관리 대응.
// seed 프리셋 + 사용자가 자재 이름 입력/엑셀 임포트로 만든 커스텀 프리셋을 합쳐 조회한다.
// 커스텀 프리셋은 localStorage에 영속화 (데스크톱 앱의 presets.json 대응).

import { seedColorPresets, type ColorPreset } from './domain/presets';

const CUSTOM_KEY = 'cutmaster.customColors';
const OVERRIDE_KEY = 'cutmaster.colorOverrides';

/**
 * 웹 전용 추가 내장 프리셋 — 국내 판재·인테리어 필름 유통에서 흔히 쓰는 이름들.
 * (domain/presets.ts 의 seed 는 Flutter 원본 1:1 포팅이라 건드리지 않고 여기서 확장한다.)
 */
export const extraColorPresets: ColorPreset[] = [
  // 목재 톤 (외래어 유통명)
  { id: 'cpw_oak', name: '오크', argb: 0xffc19a6b },
  { id: 'cpw_white_oak', name: '화이트오크', argb: 0xffdcc7a8 },
  { id: 'cpw_walnut', name: '월넛', argb: 0xff6b4a33 },
  { id: 'cpw_ash', name: '애쉬', argb: 0xffe4d7bd },
  { id: 'cpw_teak', name: '티크', argb: 0xffa97444 },
  { id: 'cpw_cherry', name: '체리', argb: 0xff9c4f3c },
  { id: 'cpw_merbau', name: '멀바우', argb: 0xff7c4a26 },
  { id: 'cpw_alder', name: '엘다', argb: 0xffe7c99a },
  { id: 'cpw_hinoki', name: '편백', argb: 0xfff3e5c8 },
  { id: 'cpw_misong', name: '미송', argb: 0xffeacd96 },
  { id: 'cpw_red_pine', name: '레드파인', argb: 0xffd9a566 },
  { id: 'cpw_rubber', name: '고무나무', argb: 0xffe9d3a6 },
  { id: 'cpw_cedar', name: '삼나무', argb: 0xffd2a678 },
  { id: 'cpw_larch', name: '낙엽송', argb: 0xffc79a5b },
  // 무지 색상 (LPM·인테리어 필름 톤)
  { id: 'cpw_white', name: '화이트', argb: 0xffffffff },
  { id: 'cpw_ivory', name: '아이보리', argb: 0xfff4ecd8 },
  { id: 'cpw_cream', name: '크림', argb: 0xfff9f2e2 },
  { id: 'cpw_gray', name: '그레이', argb: 0xff9ca3af },
  { id: 'cpw_charcoal', name: '차콜', argb: 0xff44464a },
  { id: 'cpw_black', name: '블랙', argb: 0xff1a1a1a },
  { id: 'cpw_navy', name: '네이비', argb: 0xff243b56 },
  { id: 'cpw_mint', name: '민트', argb: 0xffa8d5c5 },
  { id: 'cpw_indi_pink', name: '인디핑크', argb: 0xffd8a0a0 },
  { id: 'cpw_concrete', name: '콘크리트', argb: 0xffaeaba3 },
  // 소재
  { id: 'cpw_mdf', name: 'MDF', argb: 0xffbc9a68 },
  { id: 'cpw_pb', name: 'PB', argb: 0xffcdb287 },
  { id: 'cpw_osb', name: 'OSB', argb: 0xffd6b471 },
  { id: 'cpw_plywood', name: '합판', argb: 0xffdec292 },
];

/** seed(원본 포팅) + 웹 추가 내장 프리셋. */
const builtinColorPresets: ColorPreset[] = [...seedColorPresets, ...extraColorPresets];

let customPresets: ColorPreset[] | null = null;
let overrides: Record<string, number> | null = null;

function loadCustom(): ColorPreset[] {
  if (customPresets != null) return customPresets;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const parsed: unknown = raw == null ? [] : JSON.parse(raw);
    customPresets = Array.isArray(parsed)
      ? parsed.filter(
          (c): c is ColorPreset =>
            typeof c === 'object' && c != null &&
            typeof (c as ColorPreset).id === 'string' &&
            typeof (c as ColorPreset).name === 'string' &&
            typeof (c as ColorPreset).argb === 'number',
        )
      : [];
  } catch {
    // storage 불가(SSR·사파리 시크릿 등) — 메모리에서만 유지.
    customPresets = [];
  }
  return customPresets;
}

function saveCustom(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customPresets ?? []));
  } catch {
    // 영속화 실패는 무시 — 메모리에서만 유지.
  }
}

function loadOverrides(): Record<string, number> {
  if (overrides != null) return overrides;
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    const parsed: unknown = raw == null ? {} : JSON.parse(raw);
    overrides =
      typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(([, v]) => typeof v === 'number'),
          )
        : {};
  } catch {
    // storage 불가(SSR·사파리 시크릿 등) — 메모리에서만 유지.
    overrides = {};
  }
  return overrides;
}

function saveOverrides(): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides ?? {}));
  } catch {
    // 영속화 실패는 무시 — 메모리에서만 유지.
  }
}

/** 내장(seed+추가) + 커스텀 전체 프리셋 — 사용자 색상 오버라이드가 적용된 상태. */
export function allColorPresets(): ColorPreset[] {
  const ov = loadOverrides();
  return [...builtinColorPresets, ...loadCustom()].map((c) =>
    ov[c.id] != null ? { ...c, argb: ov[c.id] } : c,
  );
}

/**
 * 프리셋 색상 변경 — 커스텀은 직접 갱신, 내장은 오버라이드로 저장.
 * 내장 프리셋을 기본색으로 되돌리면 오버라이드를 지운다.
 */
export function setColorPresetArgb(id: string, argb: number): void {
  const custom = loadCustom();
  const idx = custom.findIndex((c) => c.id === id);
  if (idx >= 0) {
    customPresets = [...custom.slice(0, idx), { ...custom[idx], argb }, ...custom.slice(idx + 1)];
    saveCustom();
    return;
  }
  const builtin = builtinColorPresets.find((c) => c.id === id);
  if (builtin == null) return;
  const ov = { ...loadOverrides() };
  if (builtin.argb === argb) delete ov[id];
  else ov[id] = argb;
  overrides = ov;
  saveOverrides();
}

/** id → 프리셋 (seed + 커스텀). */
export function colorPresetById(id: string | null): ColorPreset | null {
  if (id == null) return null;
  return allColorPresets().find((c) => c.id === id) ?? null;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** 새 자재 이름의 기본 ARGB — 원본 _autoArgbForName 대응. 이름 hash 기반으로 안정적. */
export function autoArgbForName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('화이트') || n.includes('white') || n.includes('백색')) return 0xfff7f7f2;
  if (n.includes('블랙') || n.includes('black') || n.includes('검정')) return 0xff262626;
  if (n.includes('그레이') || n.includes('gray') || n.includes('회색')) return 0xffa8a29e;
  return (0xff000000 | (hashString(name) & 0xffffff)) >>> 0;
}

/**
 * 자재 이름 → colorPresetId. 원본 _findOrCreateColorByName 대응:
 * - 빈 이름 → null (자동 색상)
 * - 기존 프리셋 이름과 정확 일치 → 그 id
 * - 일치 없음 → 커스텀 프리셋 자동 생성 후 새 id
 */
export function findOrCreateColorByName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return null;
  const existing = allColorPresets().find((c) => c.name === trimmed);
  if (existing != null) return existing.id;
  const created: ColorPreset = {
    id: `cp_inline_${(hashString(trimmed) & 0xffff).toString(16)}`,
    name: trimmed,
    argb: autoArgbForName(trimmed),
  };
  customPresets = [...loadCustom(), created];
  saveCustom();
  return created.id;
}

/**
 * 프로젝트 JSON에 부품이 참조하는 자재 프리셋을 동봉 — `colorPresets` 키.
 * 데스크톱 앱은 모르는 키를 무시하므로 .cutmaster(schemaVersion 4) 호환이 유지되고,
 * 웹에서 다시 열면 커스텀 자재 이름/색이 복원된다.
 */
export function attachColorPresets(
  json: Record<string, unknown>,
  parts: { colorPresetId: string | null }[],
): Record<string, unknown> {
  const used = new Map<string, ColorPreset>();
  for (const p of parts) {
    if (p.colorPresetId == null || used.has(p.colorPresetId)) continue;
    const preset = colorPresetById(p.colorPresetId);
    if (preset != null) used.set(preset.id, preset);
  }
  if (used.size === 0) return json;
  return { ...json, colorPresets: [...used.values()] };
}

/**
 * 로드한 프로젝트 JSON의 `colorPresets` 를 커스텀 프리셋 스토어에 등록.
 * 내장(seed+추가) 프리셋과 겹치는 id 는 건너뛰고, 이미 아는 커스텀 id 는 이름/색을 갱신한다.
 */
export function registerColorPresetsFromJson(json: Record<string, unknown>): void {
  const list = json.colorPresets;
  if (!Array.isArray(list)) return;
  let changed = false;
  let next = loadCustom();
  for (const c of list) {
    if (
      typeof c !== 'object' || c == null ||
      typeof (c as ColorPreset).id !== 'string' ||
      typeof (c as ColorPreset).name !== 'string' ||
      typeof (c as ColorPreset).argb !== 'number'
    ) {
      continue;
    }
    const preset = c as ColorPreset;
    if (builtinColorPresets.some((s) => s.id === preset.id)) continue;
    const idx = next.findIndex((x) => x.id === preset.id);
    if (idx >= 0) {
      if (next[idx].name === preset.name && next[idx].argb === preset.argb) continue;
      next = [...next.slice(0, idx), preset, ...next.slice(idx + 1)];
    } else {
      next = [...next, preset];
    }
    changed = true;
  }
  if (changed) {
    customPresets = next;
    saveCustom();
  }
}

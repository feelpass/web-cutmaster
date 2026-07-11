// cutmaster(Flutter) data/preset/preset_seeds.dart 의 색상(자재) 프리셋 포팅.

export interface ColorPreset {
  id: string;
  name: string;
  argb: number;
}

export const seedColorPresets: ColorPreset[] = [
  // vivid
  { id: 'cp_red', name: '빨강', argb: 0xffef4444 },
  { id: 'cp_orange', name: '주황', argb: 0xfff97316 },
  { id: 'cp_yellow', name: '황색', argb: 0xffeab308 },
  { id: 'cp_lime', name: '연두', argb: 0xff84cc16 },
  { id: 'cp_green', name: '초록', argb: 0xff16a34a },
  { id: 'cp_teal', name: '청록', argb: 0xff14b8a6 },
  { id: 'cp_sky', name: '하늘', argb: 0xff0ea5e9 },
  { id: 'cp_blue', name: '남색', argb: 0xff3b82f6 },
  { id: 'cp_purple', name: '보라', argb: 0xff8b5cf6 },
  { id: 'cp_magenta', name: '자홍', argb: 0xffd946ef },
  { id: 'cp_pink', name: '분홍', argb: 0xffec4899 },
  { id: 'cp_crimson', name: '진홍', argb: 0xffbe123c },
  // wood-tone
  { id: 'cp_birch', name: '자작', argb: 0xfffaf1dc },
  { id: 'cp_maple', name: '단풍', argb: 0xffe8d2a6 },
  { id: 'cp_beige', name: '베이지', argb: 0xffd4b896 },
  { id: 'cp_pine', name: '솔송', argb: 0xffc9a876 },
  { id: 'cp_oak', name: '적참', argb: 0xffb8865c },
  { id: 'cp_walnut', name: '호두', argb: 0xff8b6240 },
  { id: 'cp_ebony', name: '흑단', argb: 0xff3d2a1e },
  { id: 'cp_white_mel', name: '백색멜라민', argb: 0xfff7f7f2 },
  { id: 'cp_lt_gray', name: '연회색', argb: 0xffd4d4d4 },
  { id: 'cp_mdf_gray', name: '회색MDF', argb: 0xffa8a29e },
  { id: 'cp_dk_gray', name: '진회색', argb: 0xff6b6b6b },
  { id: 'cp_black_mel', name: '검정멜라민', argb: 0xff262626 },
];

/** ARGB int → CSS hex (#rrggbb). */
export function argbToCss(argb: number): string {
  const rgb = argb & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

export function colorPresetById(id: string | null): ColorPreset | null {
  if (id == null) return null;
  return seedColorPresets.find((c) => c.id === id) ?? null;
}

/** 밝은 색 위엔 어두운 텍스트, 어두운 색 위엔 밝은 텍스트. */
export function contrastTextColor(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 150 ? '#1f2937' : '#ffffff';
}

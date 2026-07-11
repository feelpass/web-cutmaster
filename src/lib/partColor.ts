// cutmaster(Flutter) ui/utils/part_color.dart 의 auto 색상 로직 대응.
// user 명시 색(colorPresetId) 우선, 없으면 id 해시 기반 golden-angle hue.

import type { CutPart } from './domain/models';
import { argbToCss, colorPresetById } from './domain/presets';

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}

/** ID 해시 기반 deterministic auto 색상 (부품 팔레트 — vivid). */
export function autoPartColor(id: string): string {
  const hash = hashString(id);
  const hue = (hash * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 65%, 55%)`;
}

/** 부품 표시 색상 결정 — 프리셋 우선, 없으면 auto. */
export function partFillColor(part: CutPart): string {
  const preset = colorPresetById(part.colorPresetId);
  if (preset != null) return argbToCss(preset.argb);
  return autoPartColor(part.id);
}

/** 부품 색 위의 텍스트 색 (밝기 대비). */
export function partTextColor(part: CutPart): string {
  const preset = colorPresetById(part.colorPresetId);
  if (preset != null) {
    const r = (preset.argb >> 16) & 0xff;
    const g = (preset.argb >> 8) & 0xff;
    const b = preset.argb & 0xff;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma > 150 ? '#1f2937' : '#ffffff';
  }
  return '#ffffff'; // auto 색은 lightness 55% — 흰 텍스트가 무난.
}

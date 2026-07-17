// cutmaster(Flutter) domain/models/plan_summary.dart 포팅.
// (label, length, width, colorPresetId, thickness, stockMaterialId) 단위로 부품을,
// (colorPresetId, thickness, stockMaterialId) 단위로 자재를 합산한 derived view-model.

import type { CuttingPlan } from './models';
import { estimateGuillotineCuts, partMaterialKey } from './models';

export interface MaterialUsage {
  /** (colorPresetId, thickness, stockMaterialId) 조합의 안정적 고유 키. 표시 이름은 서로 다른
   *  colorPresetId가 '기본'으로 폴백하면 중복될 수 있어 이름 대신 이걸 key로 쓴다. */
  id: string;
  name: string;
  sheetCount: number;
  usedAreaMm2: number;
}

export interface PartGroup {
  label: string;
  length: number;
  width: number;
  materialName: string;
  qty: number;
}

export interface PlanSummary {
  totalSheets: number;
  totalPlacedParts: number;
  totalUsedAreaMm2: number;
  totalCuts: number;
  cutsAreEstimated: boolean;
  efficiencyPercent: number;
  materialUsages: MaterialUsage[];
  partGroups: PartGroup[];
}

function materialDisplayName(
  colorName: string | null,
  thickness: number,
  stockName: string | null,
): string {
  const base = colorName == null || colorName === '' ? '기본' : colorName;
  const suffix = stockName != null && stockName !== '' ? ` · ${stockName}` : '';
  if (thickness <= 0) return `${base}${suffix}`;
  return `${base} ${thickness.toFixed(0)}T${suffix}`;
}

export function planSummaryFromPlan(
  plan: CuttingPlan,
  colorName: (colorPresetId: string | null) => string | null,
  /** 부품 stockMaterialId → 원장 자재 이름. 미지정이면 이름을 덧붙이지 않는다. */
  stockMaterialName?: (stockMaterialId: string) => string | null,
): PlanSummary {
  let placed = 0;
  let usedArea = 0;
  let cuts = 0;
  let anyEstimated = false;

  const materialMap = new Map<string, { id: string; name: string; sheetCount: number; usedAreaMm2: number }>();
  const partMap = new Map<string, PartGroup>();

  const stockName = (id: string | null): string | null =>
    id != null ? (stockMaterialName?.(id) ?? null) : null;

  for (const s of plan.sheets) {
    placed += s.placed.length;

    cuts += estimateGuillotineCuts(s);
    if (s.cutSequence == null && s.placed.length > 0) {
      anyEstimated = true;
    }

    // 시트가 어느 자재인지: 첫 부품의 (color, thickness)로 결정.
    let sheetKey: string | null = null;
    let sheetKeyName: string | null = null;
    if (s.placed.length > 0) {
      const p = s.placed[0].part;
      sheetKey = partMaterialKey(p);
      sheetKeyName = materialDisplayName(
        colorName(p.colorPresetId),
        p.thickness,
        stockName(p.stockMaterialId),
      );
    }

    let sheetUsedArea = 0;
    for (const placedPart of s.placed) {
      const part = placedPart.part;
      const area = part.length * part.width;
      usedArea += area;
      sheetUsedArea += area;

      const pk = `${part.label}|${part.length}|${part.width}|${partMaterialKey(part)}`;
      const acc = partMap.get(pk);
      if (acc) {
        acc.qty += 1;
      } else {
        partMap.set(pk, {
          label: part.label,
          length: part.length,
          width: part.width,
          materialName: materialDisplayName(
            colorName(part.colorPresetId),
            part.thickness,
            stockName(part.stockMaterialId),
          ),
          qty: 1,
        });
      }
    }

    if (sheetKey != null) {
      const acc = materialMap.get(sheetKey);
      if (acc) {
        acc.sheetCount += 1;
        acc.usedAreaMm2 += sheetUsedArea;
      } else {
        materialMap.set(sheetKey, {
          id: sheetKey,
          name: sheetKeyName!,
          sheetCount: 1,
          usedAreaMm2: sheetUsedArea,
        });
      }
    }
  }

  const materials = [...materialMap.values()].sort((a, b) => b.sheetCount - a.sheetCount);
  const parts = [...partMap.values()].sort((a, b) => b.qty - a.qty);

  return {
    totalSheets: plan.sheets.length,
    totalPlacedParts: placed,
    totalUsedAreaMm2: usedArea,
    totalCuts: cuts,
    cutsAreEstimated: anyEstimated,
    efficiencyPercent: plan.efficiencyPercent,
    materialUsages: materials,
    partGroups: parts,
  };
}

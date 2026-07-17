// cutmaster(Flutter) ui/providers/solver_provider.dart 의 runCalculate 로직 포팅.
// 자재(color+두께)별 그룹핑 → 그룹마다 솔버 실행 → 헤드컷 오프셋 → 병합.

import type { CutPart, CuttingPlan, LeftoverRect, PlacedPart, Project, SheetLayout, StockSheet, StockSizeConfig } from './models';
import { derivedStocks, partMaterialKey } from './models';
import { TreeSearchSolver, type TreeSearchSolverOptions } from './treeSearchSolver';

/** (colorPresetId, thickness, stockMaterialId) 키별로 부품 그룹핑. */
function groupPartsByMaterial(parts: CutPart[]): Map<string, CutPart[]> {
  const out = new Map<string, CutPart[]>();
  for (const p of parts) {
    const k = partMaterialKey(p);
    const list = out.get(k);
    if (list) {
      list.push(p);
    } else {
      out.set(k, [p]);
    }
  }
  return out;
}

/** derivedStocks가 만든 stock id (`auto_<color>|<thickness>|<stockMaterial>`)에서 키 추출. */
function stockKey(s: StockSheet): string {
  if (s.id.startsWith('auto_')) return s.id.substring(5);
  return `${s.colorPresetId ?? ''}|`;
}

/**
 * 프로젝트 전체 계산. 자재별로 부품을 그룹핑해 각 그룹마다 솔버를 별도 실행한다.
 * 헤드컷이 설정되어 있으면 자재의 유효 영역을 줄여 솔버에 전달하고,
 * 결과 부품 좌표는 헤드컷 오프셋만큼 이동시켜 원본 시트 좌표계에 매핑한다.
 */
export function calculatePlan(
  project: Project,
  solverOptions?: TreeSearchSolverOptions,
  stockSizes?: StockSizeConfig,
): CuttingPlan {
  const allStocks = derivedStocks(project, stockSizes);
  const groups = groupPartsByMaterial(project.parts);
  const hcLeft = project.headcutLeft;
  const hcTop = project.headcutTop;
  const hcRight = project.headcutRight;
  const hcBottom = project.headcutBottom;
  const hcH = hcLeft + hcRight;
  const hcV = hcTop + hcBottom;

  const allSheets: SheetLayout[] = [];
  const allUnplaced: CutPart[] = [];
  let totalUsed = 0;
  let totalArea = 0;

  const solver = new TreeSearchSolver(solverOptions);

  for (const [key, groupParts] of groups) {
    const groupStock = allStocks.find((s) => stockKey(s) === key) ?? allStocks[0];

    // 헤드컷 적용 — 솔버에는 줄어든 유효 영역만 보여줌.
    const effLength = Math.max(0, groupStock.length - hcH);
    const effWidth = Math.max(0, groupStock.width - hcV);
    const effectiveStock: StockSheet = {
      id: groupStock.id,
      length: effLength,
      width: effWidth,
      qty: groupStock.qty,
      label: groupStock.label,
      grainDirection: groupStock.grainDirection,
      colorPresetId: groupStock.colorPresetId,
    };

    const plan = solver.solve({
      stocks: [effectiveStock],
      parts: groupParts,
      kerf: project.kerf,
      grainLocked: project.grainLocked,
    });

    // 좌표를 원본 시트 기준으로 오프셋해 시각화 + 실제 절단 좌표 일치.
    for (const s of plan.sheets) {
      const offsetPlaced: PlacedPart[] = s.placed.map((p) => ({
        part: p.part,
        x: p.x + hcLeft,
        y: p.y + hcTop,
        rotated: p.rotated,
      }));
      const offsetLeftovers: LeftoverRect[] = s.leftovers.map((r) => ({
        x: r.x + hcLeft,
        y: r.y + hcTop,
        width: r.width,
        height: r.height,
      }));
      allSheets.push({
        stockSheetId: s.stockSheetId,
        placed: offsetPlaced,
        // 시트 차원은 원본 원장 크기 유지 — 헤드컷 음영 영역 시각 인식.
        sheetLength: groupStock.length,
        sheetWidth: groupStock.width,
        cutSequence: s.cutSequence,
        leftovers: offsetLeftovers,
      });

      // 효율: 유효 영역(헤드컷 제외) 기준으로 계산.
      totalArea += effLength * effWidth;
      for (const p of s.placed) {
        totalUsed += p.part.length * p.part.width;
      }
    }
    allUnplaced.push(...plan.unplaced);
  }

  const eff = totalArea === 0 ? 0 : (totalUsed / totalArea) * 100;
  return {
    sheets: allSheets,
    unplaced: allUnplaced,
    efficiencyPercent: eff,
  };
}

'use client';

import type { CuttingPlan, Project } from '@/lib/domain/models';
import { sheetUsedPercent } from '@/lib/domain/models';
import { planSummaryFromPlan } from '@/lib/domain/planSummary';
import { colorPresetById } from '@/lib/domain/presets';
import { SheetSvg } from './SheetSvg';

interface Props {
  project: Project;
  plan: CuttingPlan | null;
  calculating: boolean;
}

function Chip({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`px-3 py-1.5 rounded-md border text-sm flex items-baseline gap-1.5 ${
        warn ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-surface'
      }`}
    >
      <span className={`text-xs ${warn ? 'text-red-500' : 'text-muted'}`}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function ResultPane({ project, plan, calculating }: Props) {
  if (calculating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
        <p className="text-sm">최적 배치 탐색 중… (자재별 최대 8초)</p>
      </div>
    );
  }

  if (plan == null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1 text-muted">
        <p className="text-base">부품을 입력하고</p>
        <p className="text-base font-medium text-foreground">▶ 계산 버튼을 눌러주세요</p>
      </div>
    );
  }

  const summary = planSummaryFromPlan(plan, (id) => colorPresetById(id)?.name ?? null);
  const headcut = {
    top: project.headcutTop,
    bottom: project.headcutBottom,
    left: project.headcutLeft,
    right: project.headcutRight,
  };

  // 미배치 부품 그룹핑 표시용.
  const unplacedGroups = new Map<string, number>();
  for (const p of plan.unplaced) {
    const k = `${p.label !== '' ? `${p.label} ` : ''}${p.length}×${p.width}`;
    unplacedGroups.set(k, (unplacedGroups.get(k) ?? 0) + 1);
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      <div className="flex gap-2 flex-wrap">
        <Chip label="시트" value={`${summary.totalSheets}매`} />
        <Chip label="효율" value={`${summary.efficiencyPercent.toFixed(1)}%`} />
        <Chip
          label="절단"
          value={`${summary.cutsAreEstimated ? '≈' : ''}${summary.totalCuts}회`}
        />
        <Chip label="부품" value={`${summary.totalPlacedParts}개`} />
        {plan.unplaced.length > 0 && (
          <Chip label="미배치" value={`${plan.unplaced.length}개`} warn />
        )}
      </div>

      {plan.unplaced.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 text-sm text-red-700">
          <p className="font-medium mb-0.5">배치하지 못한 부품이 있습니다</p>
          <p className="text-xs">
            {[...unplacedGroups.entries()].map(([k, n]) => `${k} ×${n}`).join(', ')}
          </p>
        </div>
      )}

      {summary.materialUsages.length > 0 && (
        <div className="text-xs text-muted flex gap-3 flex-wrap">
          {summary.materialUsages.map((m) => (
            <span key={m.id}>
              {m.name} <b className="text-foreground">{m.sheetCount}매</b>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-5 grid-cols-1 xl:grid-cols-2">
        {plan.sheets.map((s, i) => {
          const first = s.placed[0]?.part;
          const materialName =
            first != null
              ? `${colorPresetById(first.colorPresetId)?.name ?? '기본'} ${first.thickness}T`
              : '';
          return (
            <figure key={i} className="min-w-0">
              <SheetSvg sheet={s} showLabels={project.showPartLabels} headcut={headcut} />
              <figcaption className="mt-1 text-xs text-muted flex justify-between">
                <span>
                  시트 {i + 1}
                  {materialName !== '' ? ` · ${materialName}` : ''}
                </span>
                <span>
                  {s.placed.length}개 부품 · 사용률 {sheetUsedPercent(s).toFixed(1)}%
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

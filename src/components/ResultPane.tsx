'use client';

import { useRef, useState } from 'react';
import type { CutPart, CuttingPlan, Project } from '@/lib/domain/models';
import { sheetUsedPercent } from '@/lib/domain/models';
import { planSummaryFromPlan } from '@/lib/domain/planSummary';
import { edgeUsagesFromParts } from '@/lib/domain/edgeBanding';
import { track } from '@/lib/analytics';
import { colorPresetById } from '@/lib/colorPresets';
import { stockMaterialById } from '@/lib/stockMaterials';
import { exportSheetsToPngZip } from '@/lib/sheetImageExport';
import { SheetSvg } from './SheetSvg';

/** 시트 헤더용 자재 표기 — 색상명 두께T (+ 원장 자재명). */
export function sheetMaterialLabel(first: CutPart): string {
  const stock = stockMaterialById(first.stockMaterialId);
  return `${colorPresetById(first.colorPresetId)?.name ?? '기본'} ${first.thickness}T${
    stock != null ? ` · ${stock.name}` : ''
  }`;
}

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
  const gridRef = useRef<HTMLDivElement>(null);
  const [savingPng, setSavingPng] = useState(false);

  const savePng = async () => {
    const grid = gridRef.current;
    if (plan == null || grid == null || savingPng) return;
    setSavingPng(true);
    try {
      const svgs = [...grid.querySelectorAll<SVGSVGElement>('figure svg')];
      const headers = plan.sheets.map((s, i) => {
        const first = s.placed[0]?.part;
        const material = first != null ? ` · ${sheetMaterialLabel(first)}` : '';
        return `시트 ${i + 1} / ${plan.sheets.length} · ${s.sheetLength.toFixed(0)} × ${s.sheetWidth.toFixed(0)} mm${material} · 효율 ${sheetUsedPercent(s).toFixed(1)}%`;
      });
      const zipName = `${project.name.trim() !== '' ? project.name.trim() : 'cutmaster'}-시트.zip`;
      await exportSheetsToPngZip(svgs, headers, zipName);
      track('export_png_zip', { sheet_count: plan.sheets.length });
    } catch (e) {
      alert(`이미지 저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSavingPng(false);
    }
  };

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

  const summary = planSummaryFromPlan(
    plan,
    (id) => colorPresetById(id)?.name ?? null,
    (id) => stockMaterialById(id)?.name ?? null,
  );
  const edgeUsages = edgeUsagesFromParts(project.parts, project.edgeMargin);
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
      <div className="flex gap-2 flex-wrap items-center">
        <Chip label="시트" value={`${summary.totalSheets}매`} />
        <Chip label="효율" value={`${summary.efficiencyPercent.toFixed(1)}%`} />
        <Chip
          label="절단"
          value={`${summary.cutsAreEstimated ? '≈' : ''}${summary.totalCuts}회`}
        />
        <Chip label="부품" value={`${summary.totalPlacedParts}개`} />
        <Chip label="면적" value={`${(summary.totalUsedAreaMm2 / 1e6).toFixed(3)} m²`} />
        {plan.unplaced.length > 0 && (
          <Chip label="미배치" value={`${plan.unplaced.length}개`} warn />
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            track('export_pdf', { sheet_count: plan.sheets.length });
            window.print();
          }}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50"
          title="요약 + 시트별 배치도를 인쇄 대화상자에서 PDF로 저장"
        >
          PDF 저장
        </button>
        <button
          onClick={savePng}
          disabled={savingPng}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 disabled:opacity-50"
          title="시트별 PNG 이미지를 zip 하나로 저장 (cutmaster-sheet-N.png)"
        >
          {savingPng ? '저장 중…' : '이미지 저장'}
        </button>
      </div>

      {plan.unplaced.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 text-sm text-red-700">
          <p className="font-medium mb-0.5">배치하지 못한 부품이 있습니다</p>
          <p className="text-xs">
            {[...unplacedGroups.entries()].map(([k, n]) => `${k} ×${n}`).join(', ')}
          </p>
        </div>
      )}

      {/* 재료 목록 + 엣지 소요량 + 부품 그룹 — 데스크톱 result_summary_panel 대응 */}
      {(summary.materialUsages.length > 0 || edgeUsages.length > 0 || summary.partGroups.length > 0) && (
        <div className="flex gap-4 flex-wrap items-start">
          {summary.materialUsages.length > 0 && (
            <div className="min-w-56">
              <p className="text-xs font-medium text-muted mb-1">
                재료 {summary.materialUsages.length}종
              </p>
              <table className="text-xs border border-line rounded overflow-hidden border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-muted">
                    <th className="font-medium text-left px-2 py-1 border-b border-line">자재</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-12">매수</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-16">m²</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.materialUsages.map((m) => (
                    <tr key={m.id} className="border-b border-line/60 last:border-b-0">
                      <td className="px-2 py-1">{m.name}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m.sheetCount}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {(m.usedAreaMm2 / 1e6).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {edgeUsages.length > 0 && (
            <div className="min-w-56">
              <p className="text-xs font-medium text-muted mb-1">
                엣지 {edgeUsages.length}종 (여유 {project.edgeMargin}mm 포함)
              </p>
              <table className="text-xs border border-line rounded overflow-hidden border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-muted">
                    <th className="font-medium text-left px-2 py-1 border-b border-line">엣지 자재</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-12">개소</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-20">m</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeUsages.map((e) => (
                    <tr key={`${e.name}|${e.thickness}`} className="border-b border-line/60 last:border-b-0">
                      <td className="px-2 py-1">{e.name} {e.thickness}mm</td>
                      <td className="px-2 py-1 text-right tabular-nums">{e.pieceCount}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {(Math.ceil(e.lengthMm / 100) / 10).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {summary.partGroups.length > 0 && (
            <details className="min-w-64">
              <summary className="text-xs font-medium text-muted mb-1 cursor-pointer select-none">
                부품 {summary.partGroups.length}종 (펼치기)
              </summary>
              <table className="text-xs border border-line rounded overflow-hidden border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-muted">
                    <th className="font-medium text-left px-2 py-1 border-b border-line">부품</th>
                    <th className="font-medium text-left px-2 py-1 border-b border-line">자재</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-20">사이즈</th>
                    <th className="font-medium text-right px-2 py-1 border-b border-line w-12">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.partGroups.map((p, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-b-0">
                      <td className="px-2 py-1">{p.label === '' ? '—' : p.label}</td>
                      <td className="px-2 py-1 text-muted">{p.materialName}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {p.length.toFixed(0)}×{p.width.toFixed(0)}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      <div ref={gridRef} className="grid gap-5 grid-cols-1">
        {plan.sheets.map((s, i) => {
          const first = s.placed[0]?.part;
          const materialName = first != null ? sheetMaterialLabel(first) : '';
          return (
            <figure key={i} className="min-w-0">
              <SheetSvg sheet={s} showLabels={project.showPartLabels} headcut={headcut} />
              <figcaption className="mt-1 text-xs text-muted flex justify-between">
                <span>
                  시트 {i + 1} · {s.sheetLength.toFixed(0)}×{s.sheetWidth.toFixed(0)}
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

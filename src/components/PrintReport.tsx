'use client';

// cutmaster(Flutter) ui/utils/pdf_export.dart 대응 — 인쇄 전용 리포트.
// 화면에서는 숨겨져 있다가 window.print()(PDF 저장) 시에만 보인다.
// 1페이지: 요약(KPI + 재료 표 + 부품 표), 이후 시트별 1페이지.

import type { CuttingPlan, Project } from '@/lib/domain/models';
import { sheetUsedPercent } from '@/lib/domain/models';
import { planSummaryFromPlan } from '@/lib/domain/planSummary';
import { edgeUsagesFromParts } from '@/lib/domain/edgeBanding';
import { colorPresetById } from '@/lib/colorPresets';
import { SheetSvg } from './SheetSvg';

const th = 'border border-zinc-400 bg-zinc-200 px-2 py-1 text-left font-semibold';
const td = 'border border-zinc-400 px-2 py-1';
const tdNum = `${td} text-right`;

export function PrintReport({ project, plan }: { project: Project; plan: CuttingPlan }) {
  const summary = planSummaryFromPlan(plan, (id) => colorPresetById(id)?.name ?? null);
  const edgeUsages = edgeUsagesFromParts(project.parts, project.edgeMargin);
  const dateStr = new Date().toISOString().substring(0, 10);
  const headcut = {
    top: project.headcutTop,
    bottom: project.headcutBottom,
    left: project.headcutLeft,
    right: project.headcutRight,
  };

  return (
    <div className="hidden print:block text-black text-[11px]">
      {/* 요약 페이지 */}
      <section className="break-after-page">
        <h1 className="text-lg font-bold">컷마스터 최적화 결과</h1>
        <p className="mt-0.5 text-zinc-600">
          {project.name !== '' ? `${project.name} · ` : ''}작성일 {dateStr}
        </p>
        <p className="mt-3">
          효율 {summary.efficiencyPercent.toFixed(1)}% · 시트 {summary.totalSheets}장 · 부품{' '}
          {summary.totalPlacedParts}개 · 절단 {summary.cutsAreEstimated ? '≈' : ''}
          {summary.totalCuts}회
          {plan.unplaced.length > 0 ? ` · 미배치 ${plan.unplaced.length}개` : ''}
        </p>

        <h2 className="mt-4 text-sm font-bold">재료</h2>
        <table className="mt-1.5 border-collapse">
          <thead>
            <tr>
              <th className={th}>자재</th>
              <th className={th}>시트 수</th>
              <th className={th}>사용 면적 (m²)</th>
            </tr>
          </thead>
          <tbody>
            {summary.materialUsages.map((m) => (
              <tr key={m.id}>
                <td className={td}>{m.name}</td>
                <td className={tdNum}>{m.sheetCount}</td>
                <td className={tdNum}>{(m.usedAreaMm2 / 1e6).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {edgeUsages.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-bold">엣지 (여유 {project.edgeMargin}mm 포함)</h2>
            <table className="mt-1.5 border-collapse">
              <thead>
                <tr>
                  <th className={th}>엣지 자재</th>
                  <th className={th}>개소</th>
                  <th className={th}>필요 길이 (m)</th>
                </tr>
              </thead>
              <tbody>
                {edgeUsages.map((e) => (
                  <tr key={`${e.name}|${e.thickness}`}>
                    <td className={td}>{e.name} {e.thickness}mm</td>
                    <td className={tdNum}>{e.pieceCount}</td>
                    <td className={tdNum}>{(Math.ceil(e.lengthMm / 100) / 10).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 className="mt-4 text-sm font-bold">부품</h2>
        <table className="mt-1.5 border-collapse">
          <thead>
            <tr>
              <th className={th}>부품명</th>
              <th className={th}>길이 (mm)</th>
              <th className={th}>폭 (mm)</th>
              <th className={th}>자재</th>
              <th className={th}>수량</th>
            </tr>
          </thead>
          <tbody>
            {summary.partGroups.map((p, i) => (
              <tr key={i}>
                <td className={td}>{p.label}</td>
                <td className={tdNum}>{p.length.toFixed(0)}</td>
                <td className={tdNum}>{p.width.toFixed(0)}</td>
                <td className={td}>{p.materialName}</td>
                <td className={tdNum}>{p.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 시트별 페이지 */}
      {plan.sheets.map((s, i) => {
        const first = s.placed[0]?.part;
        const material =
          first != null
            ? ` · ${colorPresetById(first.colorPresetId)?.name ?? '기본'} ${first.thickness}T`
            : '';
        return (
          <section key={i} className={i < plan.sheets.length - 1 ? 'break-after-page' : ''}>
            <p className="mb-1.5 text-zinc-700">
              시트 {i + 1} / {plan.sheets.length} · {s.sheetLength.toFixed(0)} ×{' '}
              {s.sheetWidth.toFixed(0)} mm{material} · 효율 {sheetUsedPercent(s).toFixed(1)}%
            </p>
            <SheetSvg sheet={s} showLabels={project.showPartLabels} headcut={headcut} />
            <p className="mt-1 text-right text-zinc-500 text-[9px]">cutmaster · {dateStr}</p>
          </section>
        );
      })}
    </div>
  );
}

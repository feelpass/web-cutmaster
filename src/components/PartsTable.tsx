'use client';

import { useRef, useState } from 'react';
import type { CutPart, GrainDirection } from '@/lib/domain/models';
import { createCutPart, genId } from '@/lib/domain/models';
import { importPartsFromFile } from '@/lib/domain/partsImport';
import { exportPartsToFile } from '@/lib/domain/partsExport';
import {
  applyMerge,
  detectConflicts,
  mergeSummary,
  type MergeAction,
  type PartsMergeConflict,
} from '@/lib/domain/partsMerge';
import { argbToCss } from '@/lib/domain/presets';
import { allColorPresets, colorPresetById, findOrCreateColorByName } from '@/lib/colorPresets';
import { useDialogKeys } from './useDialogKeys';

const GRAIN_LABELS: Record<GrainDirection, string> = {
  none: '없음',
  lengthwise: '가로',
  widthwise: '세로',
};

const MATERIAL_DATALIST_ID = 'cutmaster-material-names';
const EDGE_DATALIST_ID = 'cutmaster-edge-names';

/** edges [상, 하, 좌, 우] 의 면 코드 — 임포트 헤더(W1/W2/D1/D2)와 동일한 표기. */
const EDGE_FACES = [
  { code: 'W1', side: '상' },
  { code: 'W2', side: '하' },
  { code: 'D1', side: '좌' },
  { code: 'D2', side: '우' },
] as const;

/** 4면 엣지를 한 셀에 압축 표기. 예: '화이트1T(4면)', '화이트1T(W1·W2)'. 상세는 title 툴팁으로. */
function edgeSummary(edges: CutPart['edges']): { text: string; title: string } {
  const faces = EDGE_FACES.map((f, i) => ({ f: f.code, name: edges[i] })).filter((e) => e.name !== '');
  if (faces.length === 0) return { text: '', title: '' };
  const byName = new Map<string, string[]>();
  for (const { f, name } of faces) byName.set(name, [...(byName.get(name) ?? []), f]);
  const text = [...byName.entries()]
    .map(([name, fs]) => `${name}(${fs.length === 4 ? '4면' : fs.join('·')})`)
    .join(', ');
  const title = faces.map(({ f, name }) => `${f}: ${name}`).join('\n');
  return { text, title };
}

/**
 * 자재 이름 텍스트 입력 셀 — 원본 MaterialNameInput 대응.
 * 확정(blur/Enter) 시: 빈 문자열 → null, 기존 프리셋 이름 일치 → 그 id,
 * 일치 없음 → 프리셋 자동 생성 후 새 id.
 */
function MaterialCell({
  colorPresetId,
  onChange,
}: {
  colorPresetId: string | null;
  onChange: (id: string | null) => void;
}) {
  const preset = colorPresetById(colorPresetId);
  const [text, setText] = useState(preset?.name ?? '');

  // colorPresetId가 밖에서 바뀌면(임포트·행 교체) 입력 텍스트를 동기화.
  const [prevId, setPrevId] = useState(colorPresetId);
  if (prevId !== colorPresetId) {
    setPrevId(colorPresetId);
    setText(preset?.name ?? '');
  }

  const commit = () => {
    // 표시 중인 이름과 같으면 변경 없음 — 이름 미해석(id만 아는) 프리셋도 보존.
    if (text.trim() === (preset?.name ?? '')) return;
    onChange(findOrCreateColorByName(text));
  };

  return (
    <div className="flex items-center gap-1.5 px-1">
      <span
        className="w-3.5 h-3.5 rounded-sm border border-black/10 shrink-0"
        style={{
          background:
            preset != null
              ? argbToCss(preset.argb)
              : 'repeating-linear-gradient(45deg,#e5e7eb 0 3px,#fff 3px 6px)',
        }}
      />
      <input
        className="w-full bg-transparent py-1.5 text-sm focus:outline-none focus:bg-indigo-50/50 rounded"
        list={MATERIAL_DATALIST_ID}
        value={text}
        placeholder="자동"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

interface Props {
  parts: CutPart[];
  onChange: (parts: CutPart[]) => void;
  /** CSV 내보내기의 ARTICLE 컬럼·기본 파일명에 쓰는 프로젝트명. */
  projectName?: string;
  /** 임포트 파일의 ARTICLE 값 — 데스크톱처럼 프로젝트명이 비어있으면 이걸로 채운다. */
  onArticle?: (article: string) => void;
}

export function PartsTable({ parts, onChange, projectName = '', onArticle }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [merge, setMerge] = useState<{
    conflicts: PartsMergeConflict[];
    imported: CutPart[];
    article: string;
  } | null>(null);
  /** 엣지 설정 다이얼로그가 열린 부품 인덱스. */
  const [edgeEditIdx, setEdgeEditIdx] = useState<number | null>(null);

  // 엣지 설정: Enter → 완료, ESC → 닫기.
  useDialogKeys({
    active: edgeEditIdx != null,
    onConfirm: () => setEdgeEditIdx(null),
    onClose: () => setEdgeEditIdx(null),
  });
  // 머지: Enter → 덮어쓰기(오른쪽 버튼), ESC → 취소.
  useDialogKeys({
    active: merge != null,
    onConfirm: () => handleMergeAction('overwrite'),
    onClose: () => handleMergeAction('cancel'),
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 연속으로 선택할 수 있게 초기화.
    if (file == null) return;
    setImporting(true);
    setNotice(null);
    try {
      const { parts: imported, article } = await importPartsFromFile(file, findOrCreateColorByName);
      if (imported.length === 0) {
        alert('파일에서 부품을 찾지 못했습니다. 첫 행이 헤더(PART, W, D, QTY …)인지 확인하세요.');
        return;
      }
      const conflicts = detectConflicts(parts, imported);
      if (conflicts.length === 0) {
        // 충돌 0건이면 단순 append (데스크톱과 동일).
        onChange([...parts, ...imported]);
        if (article !== '') onArticle?.(article);
      } else {
        // 충돌은 사용자 선택으로 처리 — 데스크톱 parts_merge_dialog 대응.
        setMerge({ conflicts, imported, article });
      }
    } catch (err) {
      alert(`불러오기 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setImporting(false);
    }
  };

  const handleMergeAction = (action: MergeAction) => {
    if (merge == null) return;
    setMerge(null);
    if (action === 'cancel') {
      setNotice('가져오기를 취소했습니다');
      return;
    }
    const result = applyMerge(parts, merge.imported, action);
    onChange(result.mergedParts);
    if (merge.article !== '') onArticle?.(merge.article);
    setNotice(mergeSummary(result));
  };

  const handleExport = async () => {
    if (parts.length === 0) return;
    setExporting(true);
    try {
      const fileName = `${projectName !== '' ? projectName : 'parts'}.CSV`;
      await exportPartsToFile(parts, fileName, projectName, (id) => colorPresetById(id)?.name ?? '');
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExporting(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<CutPart>) => {
    const next = [...parts];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(parts.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([
      ...parts,
      createCutPart({
        id: genId(),
        length: 600,
        width: 400,
        qty: 1,
      }),
    ]);
  };

  const num = (v: string, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const inputCls =
    'w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:bg-indigo-50/50 rounded';

  // 엣지 입력 자동완성 — 현재 부품들에 쓰인 엣지 자재명.
  const edgeNames = [...new Set(parts.flatMap((p) => p.edges).filter((n) => n !== ''))];

  return (
    <section className="bg-surface border border-line rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-line">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-sm font-semibold">부품</h2>
          {notice != null && <span className="text-xs text-muted truncate">{notice}</span>}
        </div>
        <div className="flex gap-1">
          {parts.length > 0 && (
            <button
              onClick={() => {
                if (confirm('부품을 전체 삭제할까요?')) onChange([]);
              }}
              className="text-xs text-muted hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
            >
              전체 삭제
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xlsm"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-xs text-muted hover:text-foreground font-medium px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-50"
            title="엑셀/CSV 파일에서 부품 불러오기 (PART, W, D, T, MATERIAL, GRAIN, QTY …)"
          >
            {importing ? '불러오는 중…' : '엑셀 불러오기'}
          </button>
          {parts.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-xs text-muted hover:text-foreground font-medium px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-50"
              title="부품을 CSV 파일로 저장 — 데스크톱 앱과 동일 형식 (PART, W, D, T, MATERIAL, GRAIN, QTY …)"
            >
              {exporting ? '저장 중…' : 'CSV 저장'}
            </button>
          )}
          <button
            onClick={addRow}
            className="text-xs text-accent hover:text-accent-hover font-medium px-2 py-1 rounded hover:bg-indigo-50"
          >
            + 행 추가
          </button>
        </div>
      </header>

      {parts.length === 0 ? (
        <p className="px-3 py-6 text-sm text-muted text-center">
          부품을 추가하세요. 자재(2440×1220)는 부품의 자재색·두께 조합으로 자동 도출됩니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <datalist id={MATERIAL_DATALIST_ID}>
            {allColorPresets().map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <datalist id={EDGE_DATALIST_ID}>
            {edgeNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {/* table-fixed + 비율 폭 — 부품명이 남는 공간을 독식하지 않게 컬럼별로 배분. */}
          <table className="w-full min-w-[560px] text-sm border-collapse table-fixed">
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th className="font-medium text-left px-2 py-1.5 w-[16%]">부품명</th>
                <th className="font-medium text-right px-2 py-1.5 w-[12%]">가로</th>
                <th className="font-medium text-right px-2 py-1.5 w-[12%]">세로</th>
                <th className="font-medium text-right px-2 py-1.5 w-[8%]">수량</th>
                <th className="font-medium text-right px-2 py-1.5 w-[8%]">두께</th>
                <th className="font-medium text-left px-2 py-1.5 w-[11%]">결</th>
                <th className="font-medium text-left px-2 py-1.5 w-[13%]">자재</th>
                <th className="font-medium text-left px-2 py-1.5 w-[20%]">엣지</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={p.id} className="border-b border-line/60 last:border-b-0 hover:bg-zinc-50/60">
                  <td>
                    <input
                      className={inputCls}
                      value={p.label}
                      placeholder="이름"
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputCls} text-right`}
                      value={p.length}
                      onChange={(e) => updateRow(i, { length: num(e.target.value, p.length) })}
                      onBlur={(e) => {
                        e.currentTarget.value = String(p.length);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputCls} text-right`}
                      value={p.width}
                      onChange={(e) => updateRow(i, { width: num(e.target.value, p.width) })}
                      onBlur={(e) => {
                        e.currentTarget.value = String(p.width);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={`${inputCls} text-right`}
                      value={p.qty}
                      onChange={(e) =>
                        updateRow(i, { qty: Math.max(1, Math.round(num(e.target.value, p.qty))) })
                      }
                      onBlur={(e) => {
                        e.currentTarget.value = String(p.qty);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputCls} text-right`}
                      value={p.thickness}
                      onChange={(e) => updateRow(i, { thickness: num(e.target.value, p.thickness) })}
                      onBlur={(e) => {
                        e.currentTarget.value = String(p.thickness);
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="w-full bg-transparent px-1 py-1.5 text-sm focus:outline-none rounded"
                      value={p.grainDirection}
                      onChange={(e) =>
                        updateRow(i, { grainDirection: e.target.value as GrainDirection })
                      }
                    >
                      {(Object.keys(GRAIN_LABELS) as GrainDirection[]).map((g) => (
                        <option key={g} value={g}>
                          {GRAIN_LABELS[g]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <MaterialCell
                      colorPresetId={p.colorPresetId}
                      onChange={(id) => updateRow(i, { colorPresetId: id })}
                    />
                  </td>
                  {(() => {
                    const e = edgeSummary(p.edges);
                    return (
                      <td className="px-1">
                        <button
                          onClick={() => setEdgeEditIdx(i)}
                          className={`w-full text-left text-xs px-1 py-1.5 rounded hover:bg-indigo-50/50 truncate ${
                            e.text === '' ? 'text-muted' : ''
                          }`}
                          title={e.title !== '' ? e.title : '엣지 설정'}
                        >
                          {e.text === '' ? '설정' : e.text}
                        </button>
                      </td>
                    );
                  })()}
                  <td>
                    <button
                      onClick={() => removeRow(i)}
                      className="text-muted hover:text-red-600 px-2 py-1"
                      title="행 삭제"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 엣지 설정 다이얼로그 — 면(W1/W2/D1/D2)별 엣지 자재를 입력 */}
      {edgeEditIdx != null && parts[edgeEditIdx] != null && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div data-dialog className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-sm flex flex-col">
            <header className="px-4 py-3 border-b border-line">
              <h2 className="text-sm font-semibold">
                엣지 설정
                {parts[edgeEditIdx].label !== '' ? ` — ${parts[edgeEditIdx].label}` : ''}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                W1·W2는 가로(W) 방향, D1·D2는 세로(D) 방향 엣지입니다. 비우면 엣지 없음.
              </p>
            </header>
            <div className="p-4 grid grid-cols-2 gap-3">
              {EDGE_FACES.map(({ code, side }, ei) => (
                <label key={code} className="text-xs text-muted flex flex-col gap-1">
                  {code} ({side})
                  <input
                    className="border border-line rounded-md px-2 py-1.5 text-sm bg-surface text-foreground focus:outline-none focus:border-accent"
                    list={EDGE_DATALIST_ID}
                    value={parts[edgeEditIdx].edges[ei]}
                    placeholder="없음"
                    onChange={(e) => {
                      const edges = [...parts[edgeEditIdx].edges] as CutPart['edges'];
                      edges[ei] = e.target.value;
                      updateRow(edgeEditIdx, { edges });
                    }}
                  />
                </label>
              ))}
            </div>
            <footer className="px-4 py-3 border-t border-line flex justify-end">
              <button
                onClick={() => setEdgeEditIdx(null)}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover"
              >
                완료
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 중복 부품 머지 다이얼로그 — 데스크톱 parts_merge_dialog 대응 */}
      {merge != null && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div data-dialog className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-md flex flex-col">
            <header className="px-4 py-3 border-b border-line">
              <h2 className="text-sm font-semibold">중복 부품이 있습니다</h2>
            </header>
            <div className="p-4 text-sm">
              <p className="text-muted">
                기존 목록과 동일한 부품 {merge.conflicts.length}개가 발견되었습니다.
                <br />
                (이름 + 자재 + 사이즈 모두 일치)
              </p>
              <ul className="mt-3 max-h-48 overflow-y-auto text-xs text-muted space-y-0.5">
                {merge.conflicts.map((c, i) => (
                  <li key={i}>
                    • {c.incoming.label} {c.incoming.length.toFixed(0)}×{c.incoming.width.toFixed(0)} (
                    {c.incoming.thickness.toFixed(0)}T) ×{c.incoming.qty}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-medium">어떻게 처리할까요?</p>
            </div>
            <footer className="px-4 py-3 border-t border-line flex justify-end gap-1">
              <button
                onClick={() => handleMergeAction('cancel')}
                className="text-xs text-muted hover:text-foreground px-3 py-1.5 rounded-md hover:bg-zinc-100"
              >
                취소
              </button>
              <button
                onClick={() => handleMergeAction('renameAndAdd')}
                className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-md hover:bg-indigo-50"
              >
                이름 변경 후 추가
              </button>
              <button
                onClick={() => handleMergeAction('addQty')}
                className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-md hover:bg-indigo-50"
              >
                수량 증가
              </button>
              <button
                onClick={() => handleMergeAction('overwrite')}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover"
              >
                덮어쓰기
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

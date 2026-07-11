'use client';

import { useRef, useState } from 'react';
import type { CutPart, GrainDirection } from '@/lib/domain/models';
import { createCutPart, genId } from '@/lib/domain/models';
import { importPartsFromFile } from '@/lib/domain/partsImport';
import { exportPartsToFile } from '@/lib/domain/partsExport';
import { argbToCss, seedColorPresets } from '@/lib/domain/presets';

const GRAIN_LABELS: Record<GrainDirection, string> = {
  none: '없음',
  lengthwise: '가로',
  widthwise: '세로',
};

interface Props {
  parts: CutPart[];
  onChange: (parts: CutPart[]) => void;
}

export function PartsTable({ parts, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 연속으로 선택할 수 있게 초기화.
    if (file == null) return;
    setImporting(true);
    try {
      const imported = await importPartsFromFile(file);
      if (imported.length === 0) {
        alert('파일에서 부품을 찾지 못했습니다. 첫 행이 헤더(PART, W, D, QTY …)인지 확인하세요.');
        return;
      }
      onChange([...parts, ...imported]);
    } catch (err) {
      alert(`불러오기 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (parts.length === 0) return;
    setExporting(true);
    try {
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      await exportPartsToFile(parts, `부품_${stamp}.xlsx`);
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

  return (
    <section className="bg-surface border border-line rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-line">
        <h2 className="text-sm font-semibold">부품</h2>
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
              title="부품을 엑셀(xlsx) 파일로 저장 (PART, W, D, T, MATERIAL, GRAIN, QTY …)"
            >
              {exporting ? '저장 중…' : '엑셀 저장'}
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
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th className="font-medium text-left px-2 py-1.5 min-w-20">부품명</th>
                <th className="font-medium text-right px-2 py-1.5 w-20">가로</th>
                <th className="font-medium text-right px-2 py-1.5 w-20">세로</th>
                <th className="font-medium text-right px-2 py-1.5 w-14">수량</th>
                <th className="font-medium text-right px-2 py-1.5 w-14">두께</th>
                <th className="font-medium text-left px-2 py-1.5 w-18">결</th>
                <th className="font-medium text-left px-2 py-1.5 w-28">자재색</th>
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
                      type="number"
                      className={`${inputCls} text-right`}
                      value={p.length}
                      min={1}
                      onChange={(e) => updateRow(i, { length: num(e.target.value, p.length) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`${inputCls} text-right`}
                      value={p.width}
                      min={1}
                      onChange={(e) => updateRow(i, { width: num(e.target.value, p.width) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`${inputCls} text-right`}
                      value={p.qty}
                      min={1}
                      onChange={(e) =>
                        updateRow(i, { qty: Math.max(1, Math.round(num(e.target.value, p.qty))) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`${inputCls} text-right`}
                      value={p.thickness}
                      min={1}
                      onChange={(e) => updateRow(i, { thickness: num(e.target.value, p.thickness) })}
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
                    <div className="flex items-center gap-1.5 px-1">
                      <span
                        className="w-3.5 h-3.5 rounded-sm border border-black/10 shrink-0"
                        style={{
                          background:
                            p.colorPresetId != null
                              ? argbToCss(
                                  seedColorPresets.find((c) => c.id === p.colorPresetId)?.argb ??
                                    0xffd4b896,
                                )
                              : 'repeating-linear-gradient(45deg,#e5e7eb 0 3px,#fff 3px 6px)',
                        }}
                      />
                      <select
                        className="w-full bg-transparent py-1.5 text-sm focus:outline-none rounded"
                        value={p.colorPresetId ?? ''}
                        onChange={(e) =>
                          updateRow(i, { colorPresetId: e.target.value === '' ? null : e.target.value })
                        }
                      >
                        <option value="">자동</option>
                        {seedColorPresets.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
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
    </section>
  );
}

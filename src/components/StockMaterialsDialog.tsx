'use client';

import { useState } from 'react';
import {
  addStockMaterial,
  deleteStockMaterial,
  isSeedStockMaterial,
  type StockMaterial,
} from '@/lib/stockMaterials';
import { useDialogKeys } from './useDialogKeys';

interface Props {
  materials: StockMaterial[];
  /** 현재 Default 자재 id. */
  currentId: string;
  onSelectDefault: (m: StockMaterial) => void;
  /** 추가/삭제 후 목록 갱신. */
  onChanged: () => void;
  onClose: () => void;
}

/** 원장 자재(시트 규격) 관리 다이얼로그 — 추가/삭제 및 Default 지정. */
export function StockMaterialsDialog({
  materials,
  currentId,
  onSelectDefault,
  onChanged,
  onClose,
}: Props) {
  const [name, setName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');

  useDialogKeys({ active: true, onConfirm: null, onClose });

  const add = () => {
    const trimmed = name.trim();
    const len = Number(length);
    const wid = Number(width);
    if (trimmed === '') {
      alert('자재 이름을 입력하세요.');
      return;
    }
    if (!Number.isFinite(len) || len <= 0 || !Number.isFinite(wid) || wid <= 0) {
      alert('길이와 폭을 양수(mm)로 입력하세요.');
      return;
    }
    if (materials.some((m) => m.name === trimmed)) {
      alert('같은 이름의 자재가 이미 있습니다.');
      return;
    }
    addStockMaterial(trimmed, len, wid);
    setName('');
    setLength('');
    setWidth('');
    onChanged();
  };

  // 입력 필드에서 Enter로 바로 추가 (한글 IME 조합 중 Enter는 무시).
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) add();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        data-dialog
        className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-lg max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold">원장 자재 사이즈 관리</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground px-2">
            ×
          </button>
        </header>

        <div className="overflow-y-auto flex-1 p-2">
          {materials.map((m) => {
            const isDefault = m.id === currentId;
            const isSeed = isSeedStockMaterial(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name}
                    {isSeed && <span className="ml-2 text-xs text-muted font-normal">기본 제공</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {m.length} × {m.width} mm
                  </p>
                </div>
                {isDefault ? (
                  <span className="text-xs px-2.5 py-1.5 rounded-md bg-accent/10 text-accent font-medium">
                    Default
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectDefault(m)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50"
                  >
                    Default로 사용
                  </button>
                )}
                {!isSeed && (
                  <button
                    onClick={() => {
                      if (!confirm(`"${m.name}" 자재를 삭제할까요?`)) return;
                      deleteStockMaterial(m.id);
                      onChanged();
                    }}
                    className="text-xs px-2 py-1.5 rounded-md text-muted hover:text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <footer className="px-4 py-3 border-t border-line flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1 text-xs text-muted flex-1 min-w-24">
            이름
            <input
              className="border border-line rounded-md px-2 py-1 text-sm bg-surface focus:outline-none focus:border-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
              placeholder="예: 수입 PB 4×9"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted w-24">
            길이(mm)
            <input
              type="number"
              className="border border-line rounded-md px-2 py-1 text-sm text-right bg-surface focus:outline-none focus:border-accent"
              value={length}
              min={1}
              onChange={(e) => setLength(e.target.value)}
              onKeyDown={onEnter}
              placeholder="2745"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted w-24">
            폭(mm)
            <input
              type="number"
              className="border border-line rounded-md px-2 py-1 text-sm text-right bg-surface focus:outline-none focus:border-accent"
              value={width}
              min={1}
              onChange={(e) => setWidth(e.target.value)}
              onKeyDown={onEnter}
              placeholder="1220"
            />
          </label>
          <button
            onClick={add}
            className="text-xs px-3 py-2 rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            추가
          </button>
        </footer>
      </div>
    </div>
  );
}

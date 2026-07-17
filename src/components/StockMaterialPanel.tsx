'use client';

import type { StockMaterial } from '@/lib/stockMaterials';

interface Props {
  materials: StockMaterial[];
  /** 현재 Default 자재. */
  current: StockMaterial;
  onSelect: (m: StockMaterial) => void;
  onManage: () => void;
}

/** 왼쪽 입력 영역의 Default 자재(원장 규격) 선택 메뉴. */
export function StockMaterialPanel({ materials, current, onSelect, onManage }: Props) {
  return (
    <section className="bg-surface border border-line rounded-lg">
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm flex-1 min-w-0">
          <span className="text-muted shrink-0">원장 자재</span>
          <select
            className="flex-1 min-w-0 border border-line rounded-md px-2 py-1 text-sm bg-surface focus:outline-none focus:border-accent"
            value={current.id}
            onChange={(e) => {
              const m = materials.find((x) => x.id === e.target.value);
              if (m != null) onSelect(m);
            }}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.length}×{m.width})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={onManage}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 shrink-0"
          title="원장 자재 규격을 추가/삭제하고 Default를 변경합니다"
        >
          자재 관리
        </button>
      </div>
    </section>
  );
}

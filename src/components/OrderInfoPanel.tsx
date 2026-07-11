'use client';

import type { Project } from '@/lib/domain/models';

interface Props {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}

export function OrderInfoPanel({ project, onChange }: Props) {
  const inputCls =
    'w-full border border-line rounded-md px-2 py-1 text-sm bg-surface focus:outline-none focus:border-accent';

  return (
    <section className="bg-surface border border-line rounded-lg">
      <header className="px-3 py-2 border-b border-line">
        <h2 className="text-sm font-semibold">주문 정보</h2>
      </header>
      <div className="p-3 grid grid-cols-2 gap-3">
        <label className="text-sm flex flex-col gap-1">
          <span className="text-xs text-muted">주문번호</span>
          <input
            className={inputCls}
            value={project.orderNumber}
            onChange={(e) => onChange({ orderNumber: e.target.value })}
          />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-xs text-muted">납기일</span>
          <input
            type="date"
            className={inputCls}
            value={project.dueDate?.slice(0, 10) ?? ''}
            onChange={(e) =>
              onChange({ dueDate: e.target.value === '' ? null : new Date(e.target.value).toISOString() })
            }
          />
        </label>
        <label className="text-sm flex flex-col gap-1 col-span-2">
          <span className="text-xs text-muted">메모</span>
          <textarea
            className={`${inputCls} resize-y min-h-16`}
            value={project.memo}
            onChange={(e) => onChange({ memo: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

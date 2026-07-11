'use client';

import type { Project } from '@/lib/domain/models';

interface Props {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}

export function OptionsPanel({ project, onChange }: Props) {
  const num = (v: string, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const numberField = (
    label: string,
    value: number,
    onValue: (n: number) => void,
    widthCls = 'w-16',
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        className={`${widthCls} border border-line rounded-md px-2 py-1 text-sm text-right bg-surface focus:outline-none focus:border-accent`}
        value={value}
        min={0}
        onChange={(e) => onValue(num(e.target.value, value))}
      />
    </label>
  );

  return (
    <section className="bg-surface border border-line rounded-lg">
      <header className="px-3 py-2 border-b border-line">
        <h2 className="text-sm font-semibold">재단 조건</h2>
      </header>
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center gap-5 flex-wrap">
          {numberField('톱날 두께(mm)', project.kerf, (n) => onChange({ kerf: n }))}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#5e6ad2]"
              checked={project.grainLocked}
              onChange={(e) => onChange({ grainLocked: e.target.checked })}
            />
            결방향 고정 (회전 금지)
          </label>
        </div>
        <div>
          <p className="text-xs text-muted mb-1.5">헤드컷 — 자재 가장자리에서 잘라낼 mm</p>
          <div className="flex items-center gap-4 flex-wrap">
            {numberField('상', project.headcutTop, (n) => onChange({ headcutTop: n }), 'w-14')}
            {numberField('하', project.headcutBottom, (n) => onChange({ headcutBottom: n }), 'w-14')}
            {numberField('좌', project.headcutLeft, (n) => onChange({ headcutLeft: n }), 'w-14')}
            {numberField('우', project.headcutRight, (n) => onChange({ headcutRight: n }), 'w-14')}
          </div>
        </div>
      </div>
    </section>
  );
}

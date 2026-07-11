'use client';

import type { SheetLayout } from '@/lib/domain/models';
import { drawLength, drawWidth } from '@/lib/domain/models';
import { partFillColor, partTextColor } from '@/lib/partColor';

interface Props {
  sheet: SheetLayout;
  showLabels: boolean;
  headcut: { top: number; bottom: number; left: number; right: number };
}

/**
 * 결 방향을 따라 가는 평행선(나뭇결 줄무늬) — 데스크톱 sheet_painter의 _paintGrain 대응.
 * 결은 부품의 길이축(part.length)을 따라 흐른다. rotated=true면 길이축이
 * 세로축이 되므로 줄무늬도 세로로 그린다.
 */
function grainStripes(x: number, y: number, w: number, h: number, rotated: boolean) {
  const horizontal = !rotated;
  const stripeCount = 4;
  const span = horizontal ? h : w;
  const step = span / (stripeCount + 1);
  const inset = Math.min(18, span * 0.15);
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i <= stripeCount; i++) {
    const t = step * i;
    if (horizontal) {
      lines.push({ x1: x + inset, y1: y + t, x2: x + w - inset, y2: y + t });
    } else {
      lines.push({ x1: x + t, y1: y + inset, x2: x + t, y2: y + h - inset });
    }
  }
  return lines;
}

/** 시트 1장의 배치 결과 SVG 렌더링. viewBox 단위 = mm. */
export function SheetSvg({ sheet, showLabels, headcut }: Props) {
  const L = sheet.sheetLength;
  const W = sheet.sheetWidth;

  return (
    <svg
      viewBox={`0 0 ${L} ${W}`}
      className="w-full h-auto block rounded border border-line bg-[#f6f1e7]"
      role="img"
    >
      {/* 헤드컷 음영 */}
      {headcut.left > 0 && <rect x={0} y={0} width={headcut.left} height={W} fill="#00000014" />}
      {headcut.right > 0 && (
        <rect x={L - headcut.right} y={0} width={headcut.right} height={W} fill="#00000014" />
      )}
      {headcut.top > 0 && <rect x={0} y={0} width={L} height={headcut.top} fill="#00000014" />}
      {headcut.bottom > 0 && (
        <rect x={0} y={W - headcut.bottom} width={L} height={headcut.bottom} fill="#00000014" />
      )}

      {/* 부품 */}
      {sheet.placed.map((p, i) => {
        const w = drawLength(p);
        const h = drawWidth(p);
        const fill = partFillColor(p.part);
        const textColor = partTextColor(p.part);
        const fontSize = Math.min(Math.max(Math.min(w, h) * 0.2, 26), 60);
        const showText = showLabels && w > fontSize * 2 && h > fontSize * 1.4;
        const dims = `${p.part.length}×${p.part.width}${p.rotated ? ' ↻' : ''}`;
        return (
          <g key={i}>
            <rect
              x={p.x}
              y={p.y}
              width={w}
              height={h}
              fill={fill}
              fillOpacity={0.88}
              stroke="#00000040"
              strokeWidth={2}
            />
            {p.part.grainDirection !== 'none' &&
              grainStripes(p.x, p.y, w, h, p.rotated).map((l, li) => (
                <line
                  key={li}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#00000059"
                  strokeWidth={2.5}
                />
              ))}
            {showText && (
              <text
                x={p.x + w / 2}
                y={p.y + h / 2}
                textAnchor="middle"
                fill={textColor}
                fontSize={fontSize}
                fontFamily="inherit"
              >
                {p.part.label !== '' && (
                  <tspan x={p.x + w / 2} dy={-fontSize * 0.15}>
                    {p.part.label}
                  </tspan>
                )}
                <tspan
                  x={p.x + w / 2}
                  dy={p.part.label !== '' ? fontSize * 1.1 : fontSize * 0.35}
                  fontSize={fontSize * 0.85}
                >
                  {dims}
                </tspan>
              </text>
            )}
          </g>
        );
      })}

      {/* 시트 외곽선 */}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke="#a8a29e" strokeWidth={4} />
    </svg>
  );
}

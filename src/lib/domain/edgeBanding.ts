// 엣지(엣지밴딩) 소요량 계산.
// CutPart.edges 는 [상, 하, 좌, 우] — 상·하(W1/W2)는 W(length) 방향, 좌·우(D1/D2)는 D(width) 방향.
// 엣지 한 개소의 소요 길이 = 해당 치수 + 여유(margin)×2 (양끝에 여유를 하나씩 준다).
// 예: 1000×390 부품에 4면 모두 같은 엣지, 여유 30 → (1000+60)×2 + (390+60)×2 = 3020mm.

import type { CutPart } from './models';

export interface EdgeUsage {
  /** 엣지 자재명 (예: '화이트1T'). */
  name: string;
  /** 부품(패널) 두께 (mm) — 두께에 따라 필요한 엣지 폭이 다르므로 자재명과 함께 구분 키. */
  thickness: number;
  /** 엣지 개소 수 (부품 수량 × 엣지 지정 면 수). */
  pieceCount: number;
  /** 필요 총 길이 (mm, 여유 포함). */
  lengthMm: number;
}

/** 부품 목록에서 (엣지 자재 × 부품 두께)별 소요 길이를 합산. 결과는 길이 내림차순. */
export function edgeUsagesFromParts(parts: CutPart[], margin: number): EdgeUsage[] {
  const map = new Map<string, EdgeUsage>();
  for (const p of parts) {
    p.edges.forEach((name, i) => {
      if (name === '') return;
      const dim = i < 2 ? p.length : p.width; // 0,1=상·하(W) / 2,3=좌·우(D)
      const len = (dim + margin * 2) * p.qty;
      const key = `${name}|${p.thickness}`;
      const acc = map.get(key);
      if (acc) {
        acc.pieceCount += p.qty;
        acc.lengthMm += len;
      } else {
        map.set(key, { name, thickness: p.thickness, pieceCount: p.qty, lengthMm: len });
      }
    });
  }
  return [...map.values()].sort((a, b) => b.lengthMm - a.lengthMm);
}

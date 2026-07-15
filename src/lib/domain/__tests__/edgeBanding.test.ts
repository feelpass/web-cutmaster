// 엣지 소요량 계산 검증 — 사용자 예시: 1000×390 4면 엣지, 여유 30 → (1000+60)×2 + (390+60)×2 = 3020.

import { describe, expect, test } from 'vitest';
import { createCutPart, type CutPart } from '../models';
import { edgeUsagesFromParts } from '../edgeBanding';

function part(p: Partial<CutPart> & { length: number; width: number; qty: number }): CutPart {
  return createCutPart({ id: 'test', ...p });
}

describe('edgeUsagesFromParts', () => {
  test('4면 엣지 + 여유 30 → (W+60)×2 + (D+60)×2', () => {
    const parts = [
      part({ length: 1000, width: 390, qty: 1, edges: ['화이트1T', '화이트1T', '화이트1T', '화이트1T'] }),
    ];
    const usages = edgeUsagesFromParts(parts, 30);
    expect(usages).toHaveLength(1);
    expect(usages[0].name).toBe('화이트1T');
    expect(usages[0].lengthMm).toBe((1000 + 60) * 2 + (390 + 60) * 2); // 3020
    expect(usages[0].pieceCount).toBe(4);
  });

  test('수량만큼 곱해진다', () => {
    const parts = [
      part({ length: 1000, width: 390, qty: 20, edges: ['화이트1T', '화이트1T', '', ''] }),
    ];
    const usages = edgeUsagesFromParts(parts, 30);
    expect(usages[0].lengthMm).toBe((1000 + 60) * 2 * 20);
    expect(usages[0].pieceCount).toBe(40);
  });

  test('상·하는 W(length), 좌·우는 D(width) 방향으로 계산한다', () => {
    const parts = [part({ length: 1000, width: 390, qty: 1, edges: ['A', '', 'B', ''] })];
    const usages = edgeUsagesFromParts(parts, 0);
    const byName = new Map(usages.map((u) => [u.name, u.lengthMm]));
    expect(byName.get('A')).toBe(1000);
    expect(byName.get('B')).toBe(390);
  });

  test('자재별로 합산하고 길이 내림차순 정렬, 엣지 없으면 빈 배열', () => {
    const parts = [
      part({ length: 100, width: 50, qty: 1, edges: ['A', '', '', ''] }),
      part({ length: 900, width: 50, qty: 1, edges: ['B', 'A', '', ''] }),
      part({ length: 10, width: 10, qty: 5, edges: ['', '', '', ''] }),
    ];
    const usages = edgeUsagesFromParts(parts, 0);
    expect(usages.map((u) => u.name)).toEqual(['A', 'B']); // A=1000, B=900
    expect(usages[0].lengthMm).toBe(1000);
    expect(edgeUsagesFromParts([parts[2]], 30)).toEqual([]);
  });

  test('같은 엣지 자재라도 부품 두께가 다르면 별도 항목으로 구분한다', () => {
    const parts = [
      part({ length: 1000, width: 390, qty: 1, thickness: 18, edges: ['화이트1T', '', '', ''] }),
      part({ length: 800, width: 390, qty: 1, thickness: 23, edges: ['화이트1T', '', '', ''] }),
    ];
    const usages = edgeUsagesFromParts(parts, 0);
    expect(usages).toHaveLength(2);
    expect(usages.map((u) => [u.name, u.thickness, u.lengthMm])).toEqual([
      ['화이트1T', 18, 1000],
      ['화이트1T', 23, 800],
    ]);
  });
});

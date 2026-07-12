// cutmaster(Flutter) parts_merge.dart 포팅 검증 — 충돌 감지와 4가지 머지 액션.

import { describe, expect, test } from 'vitest';
import { createCutPart, type CutPart } from '../models';
import { applyMerge, detectConflicts, mergeSummary } from '../partsMerge';

function part(p: Partial<CutPart> & { id: string }): CutPart {
  return createCutPart({ length: 600, width: 400, qty: 1, ...p });
}

const existing = [
  part({ id: 'e1', label: '측판', colorPresetId: 'cp_a', thickness: 18, qty: 2 }),
  part({ id: 'e2', label: '도어', colorPresetId: null, thickness: 15 }),
];

describe('detectConflicts', () => {
  test('이름+자재+사이즈가 모두 일치할 때만 충돌', () => {
    const incoming = [
      part({ id: 'i1', label: '측판', colorPresetId: 'cp_a', thickness: 18 }), // 충돌
      part({ id: 'i2', label: '측판', colorPresetId: 'cp_b', thickness: 18 }), // 자재 다름
      part({ id: 'i3', label: '측판', colorPresetId: 'cp_a', thickness: 15 }), // 두께 다름
      part({ id: 'i4', label: '새부품' }),
    ];
    const conflicts = detectConflicts(existing, incoming);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existingIndex).toBe(0);
    expect(conflicts[0].incoming.id).toBe('i1');
  });

  test('결방향은 충돌 키에서 제외', () => {
    const incoming = [
      part({ id: 'i1', label: '측판', colorPresetId: 'cp_a', thickness: 18, grainDirection: 'lengthwise' }),
    ];
    expect(detectConflicts(existing, incoming)).toHaveLength(1);
  });
});

describe('applyMerge', () => {
  const incoming = [
    part({ id: 'i1', label: '측판', colorPresetId: 'cp_a', thickness: 18, qty: 3 }), // 충돌
    part({ id: 'i2', label: '새부품' }), // 비충돌
  ];

  test('overwrite: 충돌은 교체, 비충돌은 추가', () => {
    const r = applyMerge(existing, incoming, 'overwrite');
    expect(r.mergedParts).toHaveLength(3);
    expect(r.mergedParts[0].id).toBe('i1');
    expect(r.overwrittenCount).toBe(1);
    expect(r.addedCount).toBe(1);
  });

  test('addQty: 충돌은 수량 합산', () => {
    const r = applyMerge(existing, incoming, 'addQty');
    expect(r.mergedParts).toHaveLength(3);
    expect(r.mergedParts[0].id).toBe('e1');
    expect(r.mergedParts[0].qty).toBe(5); // 2 + 3
    expect(r.qtyMergedCount).toBe(1);
  });

  test('renameAndAdd: "이름 (2)" 형태로 추가하고, 이미 있으면 번호 증가', () => {
    const withRenamed = [...existing, part({ id: 'e3', label: '측판 (2)', colorPresetId: 'cp_a', thickness: 18 })];
    const r = applyMerge(withRenamed, incoming, 'renameAndAdd');
    const renamed = r.mergedParts.find((p) => p.id === 'i1');
    expect(renamed?.label).toBe('측판 (3)');
    expect(r.renamedCount).toBe(1);
  });

  test('cancel: 기존 목록 그대로', () => {
    const r = applyMerge(existing, incoming, 'cancel');
    expect(r.mergedParts).toEqual(existing);
  });
});

describe('mergeSummary', () => {
  test('액션별 건수를 요약한다', () => {
    const r = applyMerge(existing, [
      part({ id: 'i1', label: '측판', colorPresetId: 'cp_a', thickness: 18, qty: 3 }),
      part({ id: 'i2', label: '새부품' }),
    ], 'addQty');
    expect(mergeSummary(r)).toBe('추가 1, 수량 합산 1');
  });
});

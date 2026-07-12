// cutmaster(Flutter) data/import/parts_merge.dart 의 포팅.
// 임포트한 부품이 기존 목록과 충돌(이름+자재+사이즈 일치)할 때의 감지·머지 로직.

import type { CutPart } from './models';

export type MergeAction = 'overwrite' | 'addQty' | 'renameAndAdd' | 'cancel';

export interface PartsMergeConflict {
  existingIndex: number;
  existing: CutPart;
  incoming: CutPart;
}

export interface PartsMergeResult {
  mergedParts: CutPart[];
  addedCount: number;
  overwrittenCount: number;
  qtyMergedCount: number;
  renamedCount: number;
}

/** 충돌 키: (label.trim(), colorPresetId, length, width, thickness). grainDirection 제외. */
function key(p: CutPart): string {
  return JSON.stringify([p.label.trim(), p.colorPresetId, p.length, p.width, p.thickness]);
}

export function detectConflicts(existing: CutPart[], incoming: CutPart[]): PartsMergeConflict[] {
  const conflicts: PartsMergeConflict[] = [];
  for (const inc of incoming) {
    const incKey = key(inc);
    const i = existing.findIndex((e) => key(e) === incKey);
    if (i >= 0) {
      conflicts.push({ existingIndex: i, existing: existing[i], incoming: inc });
    }
  }
  return conflicts;
}

const INDEX_SUFFIX_PATTERN = /^(.*?)\s*\((\d+)\)$/;

function stripIndexSuffix(label: string): string {
  const m = INDEX_SUFFIX_PATTERN.exec(label);
  if (m == null) return label;
  return m[1].trim();
}

function keyInUse(parts: CutPart[], inc: CutPart, candidateLabel: string): boolean {
  return parts.some(
    (p) =>
      p.label.trim() === candidateLabel &&
      p.colorPresetId === inc.colorPresetId &&
      p.length === inc.length &&
      p.width === inc.width &&
      p.thickness === inc.thickness,
  );
}

export function applyMerge(
  existing: CutPart[],
  incoming: CutPart[],
  action: MergeAction,
): PartsMergeResult {
  if (action === 'cancel') {
    return { mergedParts: [...existing], addedCount: 0, overwrittenCount: 0, qtyMergedCount: 0, renamedCount: 0 };
  }

  const merged = [...existing];
  const conflictByIncoming = new Map<number, number>();
  for (let j = 0; j < incoming.length; j++) {
    const incKey = key(incoming[j]);
    const i = existing.findIndex((e) => key(e) === incKey);
    if (i >= 0) conflictByIncoming.set(j, i);
  }

  let added = 0;
  let overwritten = 0;
  let qtyMerged = 0;
  let renamed = 0;

  for (let j = 0; j < incoming.length; j++) {
    const inc = incoming[j];
    const existingIdx = conflictByIncoming.get(j);

    if (existingIdx == null) {
      merged.push(inc);
      added++;
      continue;
    }

    switch (action) {
      case 'overwrite':
        merged[existingIdx] = inc;
        overwritten++;
        break;
      case 'addQty':
        merged[existingIdx] = { ...merged[existingIdx], qty: merged[existingIdx].qty + inc.qty };
        qtyMerged++;
        break;
      case 'renameAndAdd': {
        const base = stripIndexSuffix(inc.label.trim());
        let n = 2;
        let candidate = `${base} (${n})`;
        while (keyInUse(merged, inc, candidate)) {
          n++;
          candidate = `${base} (${n})`;
        }
        merged.push({ ...inc, label: candidate });
        renamed++;
        break;
      }
    }
  }

  return {
    mergedParts: merged,
    addedCount: added,
    overwrittenCount: overwritten,
    qtyMergedCount: qtyMerged,
    renamedCount: renamed,
  };
}

/** 머지 결과 요약 문구 — 데스크톱 스낵바 메시지 대응. */
export function mergeSummary(r: PartsMergeResult): string {
  const parts: string[] = [];
  if (r.addedCount > 0) parts.push(`추가 ${r.addedCount}`);
  if (r.qtyMergedCount > 0) parts.push(`수량 합산 ${r.qtyMergedCount}`);
  if (r.overwrittenCount > 0) parts.push(`덮어쓰기 ${r.overwrittenCount}`);
  if (r.renamedCount > 0) parts.push(`이름 변경 추가 ${r.renamedCount}`);
  if (parts.length === 0) return '변경 사항이 없습니다';
  return parts.join(', ');
}

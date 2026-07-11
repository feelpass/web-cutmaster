// partsImport 의 역방향 — CutPart[] 를 컬럼 규약(PART, W, D, T, MATERIAL, GRAIN, QTY,
// ARTICLE, EDGE1~4, FILE, GROOVE)에 맞춰 xlsx 파일로 내보낸다.
// 내보낸 파일을 다시 불러오면 동일한 부품이 된다(ARTICLE 은 CutPart 에 대응 필드가 없어 제외).

import type { CutPart, GrainDirection } from './models';
import { seedColorPresets } from './presets';
import { saveDataToFile, type SaveFileResult } from '../projectFile';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** import 규약과 동일한 헤더 순서. */
const HEADER = [
  'PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY', 'ARTICLE',
  'EDGE1', 'EDGE2', 'EDGE3', 'EDGE4', 'FILE', 'GROOVE',
];

/** GrainDirection → GRAIN 코드. parseGrain 의 역. 0=없음, 1=가로결, 2=세로결. */
function grainCode(g: GrainDirection): number {
  switch (g) {
    case 'lengthwise':
      return 1;
    case 'widthwise':
      return 2;
    default:
      return 0;
  }
}

/** colorPresetId → 색상명. 자동(null)이거나 미매칭이면 ''. */
function colorName(id: string | null): string {
  if (id == null) return '';
  return seedColorPresets.find((c) => c.id === id)?.name ?? '';
}

/** CutPart → MATERIAL 문자열. 색상명이 있으면 `색상명_두께T`, 없으면 ''. parseMaterial 의 역. */
function materialString(p: CutPart): string {
  const name = colorName(p.colorPresetId);
  return name === '' ? '' : `${name}_${p.thickness}T`;
}

/** CutPart[] → 셀 매트릭스(첫 행=헤더). parsePartMatrix 로 그대로 되읽을 수 있다. */
export function partsToMatrix(parts: CutPart[]): (string | number)[][] {
  const rows: (string | number)[][] = [HEADER];
  for (const p of parts) {
    rows.push([
      p.label,
      p.length,
      p.width,
      p.thickness,
      materialString(p),
      grainCode(p.grainDirection),
      p.qty,
      '', // ARTICLE — CutPart 에 대응 필드 없음
      p.edges[0],
      p.edges[1],
      p.edges[2],
      p.edges[3],
      p.fileName,
      p.groove,
    ]);
  }
  return rows;
}

/**
 * 부품을 xlsx 파일로 저장. 프로젝트 내보내기(saveProjectFile)와 동일하게 저장 위치·파일명을
 * 사용자가 직접 고른다(미지원 브라우저는 다운로드 폴백). SheetJS 는 동적 import.
 */
export async function exportPartsToFile(parts: CutPart[], fileName: string): Promise<SaveFileResult> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(partsToMatrix(parts));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parts');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: XLSX_MIME });
  return saveDataToFile(
    blob,
    fileName,
    { description: 'Excel 통합 문서', accept: { [XLSX_MIME]: ['.xlsx'] } },
    XLSX_MIME,
  );
}

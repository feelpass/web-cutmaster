// cutmaster(Flutter) data/csv/parts_csv_exporter.dart 의 포팅 — partsImport 의 역방향.
// 데스크톱과 동일한 CSV 형식: 헤더에 ORIENTATION(항상 1) 포함, ARTICLE=프로젝트명,
// BOM(0xFEFF) + CRLF 로 윈도우/한글 환경 호환. 내보낸 파일을 다시 불러오면 동일한 부품이 된다.

import type { CutPart, GrainDirection } from './models';
import { seedColorPresets } from './presets';
import { saveDataToFile, type SaveFileResult } from '../projectFile';

/** import 규약과 동일한 헤더 순서 (데스크톱 PartsCsvExporter._header 대응). */
const HEADER = [
  'PART', 'W', 'D', 'T', 'MATERIAL', 'GRAIN', 'QTY', 'ARTICLE',
  'EDGE1', 'EDGE2', 'EDGE3', 'EDGE4', 'FILE', 'GROOVE', 'ORIENTATION',
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

/** colorPresetId → 색상명 (seed 기준). 자동(null)이거나 미매칭이면 ''. */
function seedColorName(id: string | null): string {
  if (id == null) return '';
  return seedColorPresets.find((c) => c.id === id)?.name ?? '';
}

/** CutPart → MATERIAL 문자열. 색상명이 있으면 `색상명_두께T`, 없으면 ''. parseMaterial 의 역.
 *  JS 의 String(number) 는 데스크톱 _fmtNum 과 동일하게 18→"18", 18.5→"18.5". */
function materialString(p: CutPart, colorNameById: (id: string | null) => string): string {
  const name = colorNameById(p.colorPresetId);
  return name === '' ? '' : `${name}_${p.thickness}T`;
}

/**
 * CutPart[] → 셀 매트릭스(첫 행=헤더). parsePartMatrix 로 그대로 되읽을 수 있다.
 * [colorNameById] 로 커스텀 프리셋 이름 조회를 주입할 수 있다 (기본은 seed만).
 * [articleName] 은 ARTICLE 컬럼에 기록 (데스크톱은 프로젝트명을 넣는다).
 */
export function partsToMatrix(
  parts: CutPart[],
  colorNameById: (id: string | null) => string = seedColorName,
  articleName = '',
): (string | number)[][] {
  const rows: (string | number)[][] = [HEADER];
  for (const p of parts) {
    rows.push([
      p.label,
      p.length,
      p.width,
      p.thickness,
      materialString(p, colorNameById),
      grainCode(p.grainDirection),
      p.qty,
      articleName,
      p.edges[0],
      p.edges[1],
      p.edges[2],
      p.edges[3],
      p.fileName,
      p.groove,
      1, // ORIENTATION — 데스크톱 익스포터도 항상 1.
    ]);
  }
  return rows;
}

/** CSV 셀 escape: 콤마, 큰따옴표, CR/LF 포함 시 큰따옴표로 감싸고 내부 따옴표는 두 번. */
function escapeCsvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

/** CutPart[] → 데스크톱과 동일한 CSV 문자열 (BOM + CRLF). */
export function partsToCsv(
  parts: CutPart[],
  articleName: string,
  colorNameById: (id: string | null) => string = seedColorName,
): string {
  const lines = partsToMatrix(parts, colorNameById, articleName).map((row) =>
    row.map((cell) => escapeCsvCell(String(cell))).join(','),
  );
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/**
 * 부품을 CSV 파일로 저장 (데스크톱 'CSV로 내보내기' 대응). 프로젝트 내보내기와 동일하게
 * 저장 위치·파일명을 사용자가 직접 고른다(미지원 브라우저는 다운로드 폴백).
 */
export async function exportPartsToFile(
  parts: CutPart[],
  fileName: string,
  articleName: string,
  colorNameById?: (id: string | null) => string,
): Promise<SaveFileResult> {
  const csv = partsToCsv(parts, articleName, colorNameById);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  return saveDataToFile(
    blob,
    fileName,
    { description: 'CSV 파일', accept: { 'text/csv': ['.csv'] } },
    'text/csv',
  );
}

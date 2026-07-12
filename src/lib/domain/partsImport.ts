// cutmaster(Flutter) data/csv/parts_csv_importer.dart + data/excel/parts_excel_importer.dart 의 포팅.
// CSV / XLSX / XLSM 파일에서 부품 행을 읽어 CutPart[] 로 변환한다.
// 첫 행은 헤더로 가정하며, 컬럼명은 대소문자를 무시하고 매칭한다.
// 컬럼 규약: PART, W, D, T, MATERIAL, GRAIN, QTY, ARTICLE, EDGE1~4, FILE, GROOVE

import type { CutPart, GrainDirection } from './models';
import { createCutPart, genId } from './models';
import { seedColorPresets } from './presets';

/** 파싱된 부품 한 행. 색상 프리셋 매칭은 toCutParts 에서 처리한다. */
export interface ParsedPartRow {
  label: string;
  length: number; // W
  width: number; // D
  thickness: number; // T
  materialColorName: string; // "백색멜라민_18T" → "백색멜라민"
  materialThickness: number; // "백색멜라민_18T" → 18
  grain: GrainDirection;
  qty: number;
  article: string;
  edges: [string, string, string, string];
  fileName: string; // FILE
  groove: string; // GROOVE
}

/**
 * MATERIAL 문자열 파서. 형식: `<색상명>_<두께>T` (예: `백색멜라민_18T` → ('백색멜라민', 18)).
 * 매칭 실패 시 (전체 문자열, 0) — fallback 두께는 호출자가 채운다.
 */
export function parseMaterial(material: string): { name: string; thickness: number } {
  const m = material.trim();
  if (m === '') return { name: '', thickness: 0 };
  const idx = m.lastIndexOf('_');
  if (idx <= 0 || idx >= m.length - 1) return { name: m, thickness: 0 };
  const namePart = m.substring(0, idx);
  const tickPart = m.substring(idx + 1);
  if (!tickPart.endsWith('T') && !tickPart.endsWith('t')) return { name: m, thickness: 0 };
  const t = Number(tickPart.substring(0, tickPart.length - 1));
  if (!Number.isFinite(t)) return { name: m, thickness: 0 };
  return { name: namePart, thickness: t };
}

/** GRAIN 값 → GrainDirection. 0=없음, 1=가로결, 2=세로결. */
function parseGrain(s: string): GrainDirection {
  switch (Number.parseInt(s.trim(), 10)) {
    case 1:
      return 'lengthwise';
    case 2:
      return 'widthwise';
    default:
      return 'none';
  }
}

/** 헤더 행 → { 대문자 컬럼명: 인덱스 }. */
function columnIndices(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    map[h.trim().toUpperCase()] = i;
  });
  return map;
}

function cell(cells: string[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= cells.length) return '';
  return (cells[idx] ?? '').trim();
}

function numOr(s: string, fallback: number): number {
  const n = Number(s);
  return s !== '' && Number.isFinite(n) ? n : fallback;
}

function mapRow(cells: string[], idx: Record<string, number>): ParsedPartRow | null {
  const partName = cell(cells, idx['PART']);
  if (partName === '') return null;

  const t = numOr(cell(cells, idx['T']), 18);
  const material = cell(cells, idx['MATERIAL']);
  const { name, thickness: mt } = parseMaterial(material);

  return {
    label: partName,
    length: numOr(cell(cells, idx['W']), 0),
    width: numOr(cell(cells, idx['D']), 0),
    thickness: t,
    materialColorName: name,
    materialThickness: mt === 0 ? t : mt,
    grain: parseGrain(cell(cells, idx['GRAIN']) || '0'),
    qty: Math.max(1, Math.round(numOr(cell(cells, idx['QTY']), 1))),
    article: cell(cells, idx['ARTICLE']),
    edges: [
      cell(cells, idx['EDGE1']),
      cell(cells, idx['EDGE2']),
      cell(cells, idx['EDGE3']),
      cell(cells, idx['EDGE4']),
    ],
    fileName: cell(cells, idx['FILE']),
    groove: cell(cells, idx['GROOVE']),
  };
}

/**
 * 셀 매트릭스(첫 행=헤더)를 ParsedPartRow[] 로. SheetJS 의 sheet_to_json({header:1}) 결과나
 * CSV 파싱 결과를 그대로 넘길 수 있다.
 */
export function parsePartMatrix(matrix: string[][]): ParsedPartRow[] {
  if (matrix.length === 0) return [];
  const idx = columnIndices(matrix[0]);
  const rows: ParsedPartRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = mapRow(matrix[i], idx);
    if (row != null) rows.push(row);
  }
  return rows;
}

/** 색상명으로 seed 프리셋 매칭. 빈 이름이거나 매칭 실패 시 null(자동 색상). */
function matchColorPresetId(name: string): string | null {
  if (name === '') return null;
  return seedColorPresets.find((c) => c.name === name)?.id ?? null;
}

/**
 * ParsedPartRow[] → CutPart[]. id 는 호출 시점에 생성한다.
 * [resolveColorId] 로 자재명 → colorPresetId 해석을 주입할 수 있다 — UI에서는
 * find-or-create(원본 _findOrCreateColorByName 대응)를 넘겨 미등록 자재도 구분을 유지한다.
 */
export function toCutParts(
  rows: ParsedPartRow[],
  resolveColorId: (name: string) => string | null = matchColorPresetId,
): CutPart[] {
  return rows.map((r) =>
    createCutPart({
      id: genId(),
      length: r.length,
      width: r.width,
      qty: r.qty,
      label: r.label,
      colorPresetId: resolveColorId(r.materialColorName),
      grainDirection: r.grain,
      thickness: r.materialThickness,
      edges: r.edges,
      fileName: r.fileName,
      groove: r.groove,
    }),
  );
}

export interface ImportPartsResult {
  parts: CutPart[];
  /** 첫 행의 ARTICLE 값 — 데스크톱은 프로젝트명이 비어있을 때 이걸로 채운다. */
  article: string;
}

/**
 * 파일(csv/xlsx/xlsm)을 읽어 부품 목록으로. SheetJS 는 동적 import 하여 초기 번들에서 제외한다.
 * 첫 시트만 읽는다.
 */
export async function importPartsFromFile(
  file: File,
  resolveColorId?: (name: string) => string | null,
): Promise<ImportPartsResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const first = wb.SheetNames[0];
  if (first == null) return { parts: [], article: '' };
  const sheet = wb.Sheets[first];
  // header:1 → 행 배열. raw:false 로 값을 문자열화, defval 로 빈 셀도 '' 유지.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  const rows = parsePartMatrix(matrix);
  return {
    parts: toCutParts(rows, resolveColorId),
    article: rows[0]?.article ?? '',
  };
}

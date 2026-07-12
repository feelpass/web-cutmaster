// cutmaster(Flutter) ui/utils/png_export.dart 대응 — 시트별 PNG 파일 저장.
// 화면에 렌더된 SheetSvg(SVG)를 canvas 로 래스터해 헤더 텍스트와 함께 PNG 로 내려받는다.

const HEADER_HEIGHT_PX = 40;
const SHEET_BG = '#f6f1e7';

/** 렌더된 시트 SVG → 헤더 텍스트가 얹힌 PNG Blob. [scale]은 px/mm (viewBox 단위=mm). */
export async function sheetSvgToPngBlob(
  svg: SVGSVGElement,
  headerText: string,
  scale = 1.2,
): Promise<Blob> {
  const viewBox = svg.viewBox.baseVal;
  const widthPx = Math.round(viewBox.width * scale);
  const heightPx = Math.round(viewBox.height * scale);

  // 독립 문서로 직렬화 — CSS 클래스가 사라지므로 크기·배경은 직접 지정한다.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  const svgText = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));

  try {
    const img = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = HEADER_HEIGHT_PX + heightPx;
    const ctx = canvas.getContext('2d');
    if (ctx == null) throw new Error('canvas 2d context 를 만들 수 없습니다');

    // 헤더 영역(흰 배경 + 텍스트) + 시트 배경.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = SHEET_BG;
    ctx.fillRect(0, HEADER_HEIGHT_PX, widthPx, heightPx);
    ctx.fillStyle = '#374151';
    ctx.font = '20px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(headerText, 8, HEADER_HEIGHT_PX / 2);

    ctx.drawImage(img, 0, HEADER_HEIGHT_PX, widthPx, heightPx);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob == null) throw new Error('PNG 인코딩에 실패했습니다');
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG 이미지를 불러오지 못했습니다'));
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 컨테이너 안의 모든 시트 SVG 를 `cutmaster-sheet-N.png` 로 내려받는다
 * (데스크톱 png_export 의 파일명 규칙). 브라우저가 다중 다운로드 허용을 물을 수 있다.
 */
export async function exportSheetsToPng(
  svgs: SVGSVGElement[],
  headers: string[],
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < svgs.length; i++) {
    const blob = await sheetSvgToPngBlob(svgs[i], headers[i] ?? '');
    downloadBlob(blob, `cutmaster-sheet-${i + 1}.png`);
    saved++;
    // 연속 다운로드가 씹히지 않게 짧은 간격.
    await new Promise((r) => setTimeout(r, 250));
  }
  return saved;
}

// .cutmaster 파일 내보내기/가져오기.
// JSON 스키마(schemaVersion 4)가 데스크톱 앱과 동일해 상호 호환된다.

import { projectFromJson, projectToJson, type Project } from './domain/models';
import { attachColorPresets, registerColorPresetsFromJson } from './colorPresets';

interface SaveFilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: SaveFilePickerType[];
}

interface WritableFileStream {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileHandle {
  name: string;
  createWritable(): Promise<WritableFileStream>;
}

declare global {
  interface Window {
    /** File System Access API — Chrome/Edge 등에서만 존재. */
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileHandle>;
  }
}

export type SaveFileResult =
  | { kind: 'picked'; fileName: string } // 사용자가 위치를 직접 선택해 저장
  | { kind: 'downloaded'; fileName: string } // 브라우저 다운로드 폴더로 저장
  | { kind: 'cancelled' }; // 저장 대화상자에서 취소

/**
 * 데이터를 파일로 저장. 지원 브라우저(Chrome/Edge)에서는 OS 저장 대화상자로 위치·파일명을
 * 직접 고르고, 미지원 브라우저(Safari/Firefox)에서는 다운로드 폴더로 내려받는다.
 * 다운로드 폴백은 항상 Blob 으로 처리하며, 문자열은 지정한 mimeType 으로 감싼다.
 */
export async function saveDataToFile(
  data: string | Blob,
  fileName: string,
  type: SaveFilePickerType,
  mimeType: string,
): Promise<SaveFileResult> {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [type] });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return { kind: 'picked', fileName: handle.name };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { kind: 'cancelled' };
      }
      throw e;
    }
  }

  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { kind: 'downloaded', fileName };
}

/**
 * 프로젝트를 .cutmaster 파일로 저장. 저장 위치·파일명은 사용자가 직접 선택.
 */
export async function saveProjectFile(project: Project): Promise<SaveFileResult> {
  // 자재 프리셋(이름/색)을 동봉해 다시 열 때 자재 구분이 복원되게 한다.
  const json = JSON.stringify(attachColorPresets(projectToJson(project), project.parts), null, 2);
  const fileName = `${project.name.trim() !== '' ? project.name : 'project'}.cutmaster`;
  return saveDataToFile(
    json,
    fileName,
    { description: 'CutMaster 프로젝트', accept: { 'application/json': ['.cutmaster'] } },
    'application/json',
  );
}

export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const j = JSON.parse(text) as Record<string, unknown>;
  registerColorPresetsFromJson(j);
  return projectFromJson(j);
}

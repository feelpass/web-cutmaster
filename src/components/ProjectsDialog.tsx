'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteCloudProject,
  listCloudProjects,
  loadCloudProject,
  type CloudProjectMeta,
} from '@/lib/cloud';
import type { Project } from '@/lib/domain/models';
import {
  deleteLocalProject,
  listLocalProjects,
  loadLocalProjectById,
  type LocalProjectMeta,
} from '@/lib/localStore';
import { readProjectFile } from '@/lib/projectFile';
import { useConfirm } from './ConfirmDialog';

interface Props {
  /** 로그인한 사용자 uid. null이면 클라우드 섹션 숨김. */
  uid: string | null;
  onOpenProject: (project: Project) => void;
  onClose: () => void;
}

function formatTime(iso: string): string {
  if (iso === '') return '';
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

interface RowProps {
  name: string;
  detail: string;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function ProjectRow({ name, detail, busy, onOpen, onDelete }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <button
        disabled={busy}
        onClick={onOpen}
        className="text-xs px-2.5 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
      >
        열기
      </button>
      <button
        disabled={busy}
        onClick={onDelete}
        className="text-xs px-2 py-1.5 rounded-md text-muted hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}

export function ProjectsDialog({ uid, onOpenProject, onClose }: Props) {
  const [localItems, setLocalItems] = useState<LocalProjectMeta[]>([]);
  const [cloudItems, setCloudItems] = useState<CloudProjectMeta[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const refreshCloud = useCallback(async () => {
    if (uid == null) return;
    try {
      setCloudItems(await listCloudProjects(uid));
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : String(e));
    }
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    // 로컬 목록은 동기지만 마이크로태스크로 미뤄 lint 규칙(동기 setState) 회피.
    void Promise.resolve().then(() => {
      if (!cancelled) setLocalItems(listLocalProjects());
    });
    if (uid != null) {
      listCloudProjects(uid)
        .then((list) => {
          if (!cancelled) setCloudItems(list);
        })
        .catch((e) => {
          if (!cancelled) setCloudError(e instanceof Error ? e.message : String(e));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const openFile = async (file: File) => {
    setBusy(true);
    try {
      onOpenProject(await readProjectFile(file));
    } catch (e) {
      alert(`파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-lg max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold">내 프로젝트</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground px-2">
            ×
          </button>
        </header>

        <div className="overflow-y-auto flex-1 p-2">
          {/* 로컬 저장소 */}
          <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">이 브라우저에 저장됨</p>
          {localItems.length === 0 && (
            <p className="text-sm text-muted px-3 py-3">
              저장된 프로젝트가 없습니다. 상단의 &ldquo;저장&rdquo;으로 현재 프로젝트를 저장해보세요.
            </p>
          )}
          {localItems.map((it) => (
            <ProjectRow
              key={it.id}
              name={it.name}
              detail={`부품 ${it.partCount}개${it.updatedAt !== '' ? ` · ${formatTime(it.updatedAt)}` : ''}`}
              busy={busy}
              onOpen={() => {
                const p = loadLocalProjectById(it.id);
                if (p != null) onOpenProject(p);
                else alert('프로젝트를 불러올 수 없습니다.');
              }}
              onDelete={async () => {
                if (
                  !(await confirm({
                    title: '프로젝트를 삭제할까요?',
                    message: `"${it.name}" 프로젝트를 이 브라우저에서 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
                    confirmLabel: '삭제',
                    danger: true,
                  }))
                )
                  return;
                deleteLocalProject(it.id);
                setLocalItems(listLocalProjects());
              }}
            />
          ))}

          {/* 클라우드 */}
          {uid != null && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-medium text-muted">클라우드</p>
              {cloudError != null && (
                <p className="text-sm text-red-600 px-3 py-2">불러오기 실패: {cloudError}</p>
              )}
              {cloudError == null && cloudItems == null && (
                <p className="text-sm text-muted px-3 py-2">불러오는 중…</p>
              )}
              {cloudItems != null && cloudItems.length === 0 && (
                <p className="text-sm text-muted px-3 py-2">클라우드에 저장된 프로젝트가 없습니다.</p>
              )}
              {cloudItems?.map((it) => (
                <ProjectRow
                  key={it.id}
                  name={it.name}
                  detail={`부품 ${it.partCount}개${it.updatedAt !== '' ? ` · ${formatTime(it.updatedAt)}` : ''}`}
                  busy={busy}
                  onOpen={async () => {
                    setBusy(true);
                    try {
                      const p = await loadCloudProject(uid, it.id);
                      if (p != null) onOpenProject(p);
                    } catch (e) {
                      alert(`열기 실패: ${e instanceof Error ? e.message : e}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onDelete={async () => {
                    if (
                      !(await confirm({
                        title: '프로젝트를 삭제할까요?',
                        message: `"${it.name}" 프로젝트를 클라우드에서 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
                        confirmLabel: '삭제',
                        danger: true,
                      }))
                    )
                      return;
                    setBusy(true);
                    try {
                      await deleteCloudProject(uid, it.id);
                      await refreshCloud();
                    } catch (e) {
                      alert(`삭제 실패: ${e instanceof Error ? e.message : e}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ))}
            </>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-line flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".cutmaster,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f != null) void openFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 disabled:opacity-50"
          >
            파일 열기 (.cutmaster)
          </button>
          <span className="text-xs text-muted">데스크톱 앱 파일과 호환됩니다</span>
        </footer>
      </div>
    </div>
    {dialog}
    </>
  );
}

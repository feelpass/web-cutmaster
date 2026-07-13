'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthButton } from '@/components/AuthButton';
import { OptionsPanel } from '@/components/OptionsPanel';
import { OrderInfoPanel } from '@/components/OrderInfoPanel';
import { PartsTable } from '@/components/PartsTable';
import { PrintReport } from '@/components/PrintReport';
import { ProjectsDialog } from '@/components/ProjectsDialog';
import { ResultPane } from '@/components/ResultPane';
import { useAuth } from '@/lib/auth-context';
import { listCloudProjects, saveProjectToCloud } from '@/lib/cloud';
import { createProject, genId, type CuttingPlan, type Project } from '@/lib/domain/models';
import {
  listLocalProjects,
  loadLocalProject,
  loadLocalProjectById,
  saveLocalProject,
  saveProjectToLocal,
} from '@/lib/localStore';
import { saveProjectFile } from '@/lib/projectFile';
import { useSolver } from '@/lib/solver/useSolver';

/** 마이그레이션 제안을 거절한 브라우저에서 다시 묻지 않기 위한 플래그. */
const MIGRATION_DISMISS_KEY = 'cutmaster.cloudMigrationDismissed';

export default function Home() {
  const { user, enabled: cloudEnabled } = useAuth();
  const solve = useSolver();

  // SSR 하이드레이션 불일치 방지 — 클라이언트에서 localStorage 복원 후 렌더.
  const [project, setProject] = useState<Project | null>(null);
  const [plan, setPlan] = useState<CuttingPlan | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 마이크로태스크로 미뤄 하이드레이션 직후 복원 (동기 setState 회피).
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setProject(loadLocalProject() ?? createProject(genId(), '새 프로젝트'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // localStorage 자동 저장 (500ms 디바운스 — 데스크톱 앱의 autosave 대응).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (project == null) return;
    if (saveTimer.current != null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLocalProject(project), 500);
    return () => {
      if (saveTimer.current != null) clearTimeout(saveTimer.current);
    };
  }, [project]);

  // 로그인 시 클라우드에 없는 로컬 프로젝트가 있으면 업로드 제안 (거절하면 다시 묻지 않음).
  const migrationCheckedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!cloudEnabled || user == null) {
      migrationCheckedUid.current = null;
      return;
    }
    if (migrationCheckedUid.current === user.uid) return;
    migrationCheckedUid.current = user.uid;
    let active = true;
    void (async () => {
      try {
        if (localStorage.getItem(MIGRATION_DISMISS_KEY) != null) return;
        const locals = listLocalProjects();
        if (locals.length === 0) return;
        const cloudIds = new Set((await listCloudProjects(user.uid)).map((c) => c.id));
        if (!active) return;
        const targets = locals.filter((l) => !cloudIds.has(l.id));
        if (targets.length === 0) return;
        if (!confirm(`이 브라우저에 저장된 프로젝트 ${targets.length}개를 클라우드로 올릴까요?`)) {
          localStorage.setItem(MIGRATION_DISMISS_KEY, '1');
          return;
        }
        let uploaded = 0;
        for (const meta of targets) {
          if (!active) return;
          const p = loadLocalProjectById(meta.id);
          if (p == null) continue;
          await saveProjectToCloud(user.uid, p);
          uploaded += 1;
        }
        if (!active) return;
        setSaveStatus(`로컬 프로젝트 ${uploaded}개를 클라우드로 올렸습니다`);
      } catch (e) {
        if (!active) return;
        alert(`클라우드로 올리기 실패: ${e instanceof Error ? e.message : e}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [cloudEnabled, user]);

  const update = useCallback((patch: Partial<Project>) => {
    setProject((p) =>
      p == null ? p : { ...p, ...patch, updatedAt: new Date().toISOString() },
    );
  }, []);

  const runCalculate = async () => {
    if (project == null || project.parts.length === 0 || calculating) return;
    setCalculating(true);
    try {
      setPlan(await solve(project));
    } catch (e) {
      alert(`계산 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCalculating(false);
    }
  };

  const newProject = () => {
    if (project != null && project.parts.length > 0) {
      if (!confirm('현재 프로젝트를 비우고 새 프로젝트를 시작할까요? (클라우드에 저장하지 않은 변경은 사라집니다)')) {
        return;
      }
    }
    setProject(createProject(genId(), '새 프로젝트'));
    setPlan(null);
  };

  /** 로컬 저장소에 항상 저장하고, 로그인 상태면 클라우드에도 함께 저장. */
  const persistProject = async (target: Project) => {
    setSaving(true);
    try {
      saveProjectToLocal(target);
      let where = '로컬';
      if (cloudEnabled && user != null) {
        await saveProjectToCloud(user.uid, target);
        where = '로컬+클라우드';
      }
      setSaveStatus(
        `"${target.name}" ${where} 저장됨 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
      );
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async () => {
    if (project == null || saving) return;
    await persistProject(project);
  };

  /** 다른 이름으로 저장 — 새 이름의 사본을 만들어 현재 프로젝트로 전환 후 저장 (원본 유지). */
  const saveProjectAs = async () => {
    if (project == null || saving) return;
    const name = window.prompt('다른 이름으로 저장 — 새 프로젝트 이름:', project.name);
    if (name == null) return; // 취소
    const trimmed = name.trim();
    if (trimmed === '') return;
    const copy: Project = {
      ...project,
      id: genId(),
      name: trimmed,
      updatedAt: new Date().toISOString(),
    };
    setProject(copy);
    await persistProject(copy);
  };

  /** .cutmaster 파일로 내보내기 — 저장 위치를 사용자가 직접 선택. */
  const exportFile = async () => {
    if (project == null) return;
    try {
      const result = await saveProjectFile(project);
      if (result.kind === 'picked') {
        setSaveStatus(`파일 저장됨: ${result.fileName}`);
      } else if (result.kind === 'downloaded') {
        setSaveStatus(`다운로드 폴더에 저장됨: ${result.fileName}`);
      }
    } catch (e) {
      alert(`내보내기 실패: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (project == null) {
    return (
      <main className="flex-1 flex items-center justify-center text-muted text-sm">
        불러오는 중…
      </main>
    );
  }

  return (
    <>
    <div className="flex flex-col min-h-dvh lg:h-dvh print:hidden">
      {/* 상단 바 */}
      <header className="h-13 shrink-0 border-b border-line bg-surface flex items-center gap-3 px-4">
        <h1 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-sm bg-accent" aria-hidden />
          CutMaster
        </h1>
        <input
          className="text-sm font-medium bg-transparent border border-transparent hover:border-line focus:border-accent rounded-md px-2 py-1 w-52 focus:outline-none"
          value={project.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="프로젝트 이름"
        />
        <button
          onClick={newProject}
          className="text-xs text-muted hover:text-foreground px-2 py-1.5 rounded-md hover:bg-zinc-100"
        >
          새 프로젝트
        </button>

        <div className="flex-1" />

        {saveStatus != null && <span className="text-xs text-muted">{saveStatus}</span>}
        <button
          onClick={saveProject}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 disabled:opacity-50"
        >
          {saving ? '저장 중…' : cloudEnabled && user != null ? '☁ 저장' : '저장'}
        </button>
        <button
          onClick={saveProjectAs}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 disabled:opacity-50"
          title="현재 내용을 새 이름의 프로젝트 사본으로 저장합니다 (원본 유지)"
        >
          다른 이름으로 저장
        </button>
        <button
          onClick={() => setShowProjectsDialog(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50"
        >
          내 프로젝트
        </button>
        <button
          onClick={exportFile}
          className="text-xs px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50"
          title=".cutmaster 파일로 내보내기 (데스크톱 앱 호환) — 저장 위치를 직접 선택"
        >
          내보내기
        </button>
        <AuthButton />
      </header>

      {/* 본문 — 좌 입력 / 우 결과 */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="lg:w-[440px] xl:w-[480px] shrink-0 lg:border-r border-line flex flex-col min-h-0">
          <div className="flex-1 lg:min-h-0 lg:overflow-y-auto p-3 space-y-3">
            <PartsTable
              parts={project.parts}
              onChange={(parts) => update({ parts })}
              projectName={project.name}
              onArticle={(article) => {
                // 데스크톱과 동일: 프로젝트명이 비어있거나 기본값일 때만 ARTICLE 로 채움.
                if (project.name === '' || project.name === '새 프로젝트') update({ name: article });
              }}
            />
            <OptionsPanel project={project} onChange={update} />
            <OrderInfoPanel project={project} onChange={update} />
          </div>
          <div className="shrink-0 sticky bottom-0 z-10 lg:static p-3 border-t border-line bg-surface">
            <button
              onClick={runCalculate}
              disabled={project.parts.length === 0 || calculating}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {calculating ? '계산 중…' : '▶ 계산'}
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 lg:overflow-y-auto p-4 flex flex-col">
          <ResultPane project={project} plan={plan} calculating={calculating} />
        </div>
      </main>

      {showProjectsDialog && (
        <ProjectsDialog
          uid={cloudEnabled && user != null ? user.uid : null}
          onOpenProject={(p) => {
            setProject(p);
            setPlan(null);
            setShowProjectsDialog(false);
          }}
          onClose={() => setShowProjectsDialog(false)}
        />
      )}

    </div>

    {/* PDF 저장(인쇄) 시에만 보이는 리포트 — 요약 + 시트별 페이지 */}
    {plan != null && <PrintReport project={project} plan={plan} />}
    </>
  );
}

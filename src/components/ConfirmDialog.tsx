'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true면 확인 버튼을 위험(빨강) 스타일로. 삭제 등 되돌릴 수 없는 작업에 사용. */
  danger?: boolean;
};

/**
 * 브라우저 native confirm() 대체용 커스텀 다이얼로그 훅.
 * `const { confirm, dialog } = useConfirm();` 후 `{dialog}`를 렌더링하고,
 * `if (!(await confirm({ title, message }))) return;` 형태로 사용한다.
 * Esc 또는 취소 → false, 확인 → true 로 resolve.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  // 최신 state를 stable한 close에서 참조하기 위한 ref (effect에서 동기화).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const close = useCallback((result: boolean) => {
    if (stateRef.current != null) {
      stateRef.current.resolve(result);
      setState(null);
    }
  }, []);

  // Esc → 취소. Enter는 전역으로 가로채지 않고, 포커스된 버튼의 기본 동작에 맡긴다
  // (열릴 때 autoFocus로 포커스를 다이얼로그 안으로 옮긴다).
  useEffect(() => {
    if (state == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, close]);

  const dialog =
    state == null ? null : (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
        <div className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-sm flex flex-col">
          <header className="px-4 py-3 border-b border-line">
            <h2 className="text-sm font-semibold">{state.opts.title}</h2>
          </header>
          {state.opts.message != null && (
            <div className="p-4 text-sm text-muted">{state.opts.message}</div>
          )}
          <footer className="px-4 py-3 border-t border-line flex justify-end gap-1">
            <button
              onClick={() => close(false)}
              autoFocus={state.opts.danger === true}
              className="text-xs text-muted hover:text-foreground px-3 py-1.5 rounded-md hover:bg-zinc-100"
            >
              {state.opts.cancelLabel ?? '취소'}
            </button>
            <button
              onClick={() => close(true)}
              autoFocus={state.opts.danger !== true}
              className={`text-xs px-3 py-1.5 rounded-md text-white ${
                state.opts.danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {state.opts.confirmLabel ?? '확인'}
            </button>
          </footer>
        </div>
      </div>
    );

  return { confirm, dialog };
}

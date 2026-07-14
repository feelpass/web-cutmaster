'use client';

import { useCallback, useEffect, useState } from 'react';

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

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const close = (result: boolean) => {
    if (state != null) {
      state.resolve(result);
      setState(null);
    }
  };

  useEffect(() => {
    if (state == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
              className="text-xs text-muted hover:text-foreground px-3 py-1.5 rounded-md hover:bg-zinc-100"
            >
              {state.opts.cancelLabel ?? '취소'}
            </button>
            <button
              onClick={() => close(true)}
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

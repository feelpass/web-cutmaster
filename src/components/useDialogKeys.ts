'use client';

import { useEffect } from 'react';

/**
 * 다이얼로그 공통 키 처리 — Enter: 기본(오른쪽) 버튼 실행, Escape: 닫기.
 * active가 false면 아무것도 하지 않는다(조건부 렌더 다이얼로그용).
 */
export function useDialogKeys({
  active,
  onConfirm,
  onClose,
}: {
  active: boolean;
  /** Enter 시 실행할 기본 액션. null이면 Enter는 무시. */
  onConfirm: (() => void) | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && onConfirm != null) {
        // 한글 IME 조합 중 Enter는 무시.
        if (e.isComposing) return;
        // 다이얼로그 안의 버튼에 포커스가 있으면 그 버튼의 기본 동작(클릭)을 존중.
        // (다이얼로그를 연 바깥 버튼에 포커스가 남은 경우는 가로채서 기본 액션 실행.)
        if (
          e.target instanceof HTMLElement &&
          e.target.tagName === 'BUTTON' &&
          e.target.closest('[data-dialog]') != null
        )
          return;
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onConfirm, onClose]);
}

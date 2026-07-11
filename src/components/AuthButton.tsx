'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export function AuthButton() {
  const { user, loading, enabled, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <span
        className="text-xs text-muted px-2 py-1 rounded border border-line bg-surface"
        title="NEXT_PUBLIC_FIREBASE_* 환경변수를 설정하면 Google 로그인과 클라우드 저장이 활성화됩니다."
      >
        클라우드 미설정
      </span>
    );
  }

  if (loading) {
    return <span className="text-xs text-muted">확인 중…</span>;
  }

  if (user == null) {
    return (
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await signInWithGoogle();
          } catch (e) {
            if (e instanceof Error && !e.message.includes('popup-closed')) {
              alert(`로그인 실패: ${e.message}`);
            }
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-line bg-surface hover:bg-zinc-50 disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        Google 로그인
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center">
          {(user.displayName ?? user.email ?? '?').charAt(0)}
        </span>
      )}
      <span className="text-sm max-w-32 truncate" title={user.email ?? ''}>
        {user.displayName ?? user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="text-xs text-muted hover:text-foreground px-2 py-1 rounded hover:bg-zinc-100"
      >
        로그아웃
      </button>
    </div>
  );
}

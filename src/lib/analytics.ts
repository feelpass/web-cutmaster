// Firebase Analytics(GA4) 이벤트 수집. measurementId가 없거나(로컬 전용 모드)
// 브라우저가 지원하지 않으면 모든 호출이 no-op — 앱 동작에 영향을 주지 않는다.

import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { firebaseApp, isAnalyticsConfigured } from './firebase';

let analyticsPromise: Promise<Analytics | null> | null = null;

function analyticsInstance(): Promise<Analytics | null> {
  if (analyticsPromise == null) {
    analyticsPromise = (async () => {
      if (typeof window === 'undefined' || !isAnalyticsConfigured) return null;
      try {
        return (await isSupported()) ? getAnalytics(firebaseApp()) : null;
      } catch {
        return null;
      }
    })();
  }
  return analyticsPromise;
}

/** 앱 시작 시 한 번 호출 — page_view 등 자동 수집을 활성화한다. */
export function initAnalytics(): void {
  void analyticsInstance();
}

/** GA4 커스텀 이벤트 전송 (fire-and-forget — 실패해도 무시). */
export function track(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  analyticsInstance()
    .then((a) => {
      if (a != null) logEvent(a, name, params);
    })
    .catch(() => {});
}

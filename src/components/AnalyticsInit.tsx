'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

/** 클라이언트 마운트 시 Firebase Analytics를 초기화한다 (렌더링 없음). */
export function AnalyticsInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}

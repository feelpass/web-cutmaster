// 솔버 Web Worker — Flutter의 solver_isolate.dart 대응.
// UI 스레드 freeze 방지를 위해 계산을 워커에서 수행한다.

import { calculatePlan } from '../domain/calculate';
import type { Project } from '../domain/models';

self.onmessage = (e: MessageEvent<{ project: Project; timeLimitMs?: number }>) => {
  const { project, timeLimitMs } = e.data;
  const plan = calculatePlan(project, timeLimitMs != null ? { timeLimitMs } : undefined);
  self.postMessage(plan);
};

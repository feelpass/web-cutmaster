// 솔버 Web Worker — Flutter의 solver_isolate.dart 대응.
// UI 스레드 freeze 방지를 위해 계산을 워커에서 수행한다.

import { calculatePlan } from '../domain/calculate';
import type { Project, StockSizeConfig } from '../domain/models';

self.onmessage = (
  e: MessageEvent<{ project: Project; stockSizes?: StockSizeConfig; timeLimitMs?: number }>,
) => {
  const { project, stockSizes, timeLimitMs } = e.data;
  const plan = calculatePlan(
    project,
    timeLimitMs != null ? { timeLimitMs } : undefined,
    stockSizes,
  );
  self.postMessage(plan);
};

'use client';

import { useCallback } from 'react';
import { calculatePlan } from '../domain/calculate';
import type { CuttingPlan, Project } from '../domain/models';

/**
 * 솔버 실행 훅. Web Worker에서 계산하고, 워커 생성이 불가능한 환경에서는
 * 메인 스레드에서 동기 계산으로 폴백한다.
 */
export function useSolver() {
  return useCallback((project: Project): Promise<CuttingPlan> => {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./worker.ts', import.meta.url));
      } catch {
        try {
          resolve(calculatePlan(project));
        } catch (err) {
          reject(err);
        }
        return;
      }
      worker.onmessage = (e: MessageEvent<CuttingPlan>) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = () => {
        worker.terminate();
        try {
          resolve(calculatePlan(project));
        } catch (err) {
          reject(err);
        }
      };
      worker.postMessage({ project });
    });
  }, []);
}

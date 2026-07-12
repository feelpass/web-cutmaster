<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CutMaster Web — 프로젝트 가이드

Flutter 데스크톱 앱 `cutmaster`를 웹으로 포팅한 합판 재단(컷리스트) 최적화 앱.
라이브: https://cutmaster-web.vercel.app (현재 env 미설정 → 로컬 전용 모드).

## 가장 중요한 규칙: 도메인 로직은 원본의 1:1 포팅

`src/lib/domain/`(솔버·계산·모델·프리셋)은 Flutter/Dart 원본 `lib/domain/`의 1:1 포팅이다.
알고리즘 동작을 임의로 "개선"하거나 리팩터링하지 말 것 — **원본과 배치 결과가 일치해야 한다.**

- 대응: `treeSearchSolver.ts` ↔ `tree_search_solver.dart`, `calculate.ts` ↔ `solver_provider`,
  `models.ts` ↔ `Project`/`derivedStocks`, `planSummary.ts` ↔ `plan_summary.dart`, `presets.ts` ↔ `preset_seeds`.
- 이 계층을 건드리면 반드시 `src/lib/domain/__tests__/`로 검증(특히 `treeSearchSolver.test.ts` 16개 — 원본 Flutter 테스트 포팅).

## 구조

- **도메인(순수 TS, 포팅)**: `src/lib/domain/` — 솔버/계산/모델/요약/프리셋/부품 입출력.
- **솔버 실행**: `src/lib/solver/` — 무거운 탐색을 Web Worker(`worker.ts`)에서 돌려 UI 스레드를 막지 않는다
  (Flutter isolate 대응). 컴포넌트는 `useSolver()` 훅으로 호출.
- **로컬 우선**: 현재 프로젝트는 localStorage에 자동 저장(`localStore.ts`). 로그인 없이 전 기능 동작.
- **선택적 클라우드**: Firebase Auth(Google) + Firestore(`firebase.ts`/`cloud.ts`/`auth-context.tsx`).
  `NEXT_PUBLIC_FIREBASE_*` env가 없으면 `isFirebaseConfigured=false`로 클라우드 UI가 비활성(로컬 전용 모드) — 이 분기를 깨지 말 것.
- **파일 호환**: `.cutmaster`(`projectFile.ts`)와 부품 CSV/Excel(`partsImport.ts`/`partsExport.ts`) — 데스크톱 앱 스키마(schemaVersion 4)와 상호 호환.

## 명령

```bash
npm run dev            # 개발 서버 (http://localhost:3000)
npm test               # vitest — 6개 파일 37개
npm run lint
npm run build
vercel deploy --prod   # 재배포 (프로젝트 cutmaster-web, 스코프 feelpass-projects)
```

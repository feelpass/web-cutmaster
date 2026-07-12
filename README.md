# CutMaster Web — 합판 재단 최적화

Flutter 데스크톱 앱 [cutmaster](../cutmaster)의 웹 버전.
동일한 재단 최적화 알고리즘(`TreeSearchSolver` — panel-saw 호환 best-first 길로틴 탐색)을
TypeScript로 포팅했으며, Google 로그인 + 클라우드(Firestore) 프로젝트 저장을 지원한다.

**라이브**: https://cutmaster-web.vercel.app — 현재 Firebase env 미설정으로 로컬 전용 모드(로그인/클라우드 비활성, 재단 기능은 정상).

## 스택

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **알고리즘**: `src/lib/domain/treeSearchSolver.ts` — 원본 Dart 솔버의 1:1 포팅.
  Web Worker(`src/lib/solver/worker.ts`)에서 실행되어 UI 스레드를 막지 않는다 (Flutter isolate 대응).
- **인증/클라우드**: Firebase Auth(Google 로그인) + Firestore
  - 경로: `users/{uid}/projects/{projectId}` — 문서 내용은 데스크톱 `.cutmaster` JSON(schemaVersion 4)과 동일.
- **로컬**: 현재 프로젝트는 localStorage에 자동 저장 (로그인 없이도 사용 가능).
- **입출력**: 부품 CSV/Excel 가져오기·내보내기(`xlsx`), `.cutmaster` 프로젝트 파일 열기·저장 (데스크톱 앱과 상호 호환).

## 원본과 동일하게 유지되는 로직

| 원본 (Dart) | 웹 (TS) |
|---|---|
| `domain/solver/tree_search_solver.dart` | `src/lib/domain/treeSearchSolver.ts` |
| `solver_provider.runCalculate` (자재 그룹핑 + 헤드컷) | `src/lib/domain/calculate.ts` |
| `Project.derivedStocks()` (2440×1220 자동 도출) | `src/lib/domain/models.ts` |
| `plan_summary.dart` | `src/lib/domain/planSummary.ts` |
| `preset_seeds.dart` (색상 프리셋 24종) | `src/lib/domain/presets.ts` |
| `test/domain/solver/*` (16 케이스) | `src/lib/domain/__tests__/treeSearchSolver.test.ts` |

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest — 솔버·부품 입출력 테스트 (6개 파일 37개; 솔버 16개는 원본 Flutter 테스트 포팅)
npm run build      # 프로덕션 빌드
```

## Firebase 설정 (클라우드 기능)

env 없이 실행하면 **로컬 전용 모드**로 동작한다 (로그인/클라우드 버튼 비활성).

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성.
2. **빌드 > Authentication > Sign-in method**에서 **Google** 공급자 활성화.
3. **빌드 > Firestore Database** 생성(프로덕션 모드), 규칙 설정:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/projects/{projectId} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

4. **프로젝트 설정 > 일반 > 내 앱**에서 웹 앱 추가 후 config 값을 복사:

   ```bash
   cp .env.local.example .env.local
   # NEXT_PUBLIC_FIREBASE_* 값 채우기
   ```

5. 배포 도메인(예: `*.vercel.app`)을 **Authentication > Settings > 승인된 도메인**에 추가.

## Vercel 배포

https://cutmaster-web.vercel.app 에 배포돼 있다 (프로젝트 `cutmaster-web`, 스코프 `feelpass-projects`).
CLI로 재배포:

```bash
vercel deploy --prod
```

클라우드 기능을 켜려면 환경변수(`NEXT_PUBLIC_FIREBASE_*` 6개)를 Vercel 프로젝트에 등록하고
(`vercel env add` 또는 대시보드) 재배포한 뒤, 배포 도메인(`cutmaster-web.vercel.app`)을
Firebase **승인된 도메인**에 추가한다. env가 없으면 로컬 전용 모드로 뜬다.

## 향후 과제

- PDF/PNG 결과 내보내기
- 사용자 정의 색상 프리셋 (현재는 시드 24종 고정)

# TinyPing Game 프로젝트 구조 안내

이 문서는 사람과 에이전트가 프로젝트 구조를 빠르게 이해하고, 새로운 기능을 추가하거나 수정할 때 참고할 수 있도록 작성되었습니다.

## 1. 개요
- 목적: 티니핑 이미지를 활용한 미니게임 모음(이름 맞추기, 스도쿠, 퍼즐)
- 핵심 특징
  - 공통 이미지 데이터(`public/data/mapping.json`) 사용
  - 게임 선택 시 URL에 반영(새로고침 시 유지)
  - Vite + React 기반 단일 페이지 앱

## 2. 기술 스택
- React 19
- Vite 7
- react-router-dom (HashRouter 사용)
- CSS 단일 파일(`src/index.css`) 기반 스타일

## 3. 라우팅 구조
- HashRouter를 사용하여 정적 호스팅 환경(gh-pages)에서도 새로고침이 안정적으로 동작
- 경로
  - `/#/name` : 이름 맞추기
  - `/#/sudoku` : 스도쿠
  - `/#/puzzle` : 퍼즐 맞추기
- 기본 경로(`/`)는 `/name`으로 리다이렉트

관련 파일
- `src/main.jsx`: HashRouter 적용
- `src/App.jsx`: 메뉴 + Routes 구성

## 4. 주요 디렉토리/파일
- `src/`
  - `App.jsx` : 상단 게임 메뉴 + 라우팅
  - `NameGame.jsx` : 이미지 가리기/이름 맞추기 게임
  - `SudokuGame.jsx` : 이미지 기반 스도쿠
  - `PuzzleGame.jsx` : 퍼즐 맞추기(드래그/스냅)
  - `sudokuUtils.js` : 스도쿠 생성/검증 로직
  - `index.css` : 전체 UI 스타일
- `public/`
  - `data/mapping.json` : 게임 공통 이미지 메타(파일 경로, 이름 등)
  - `images/` : 실제 이미지 파일

## 5. 데이터 흐름
- 모든 게임은 `mapping.json`을 fetch해서 이미지 목록을 가져옴
- 경로 처리는 `resolveAssetPath`로 base URL 대응
- 이미지 선택/게임 초기화는 각 게임 컴포넌트 내부 상태로 관리

## 6. 게임별 구조 요약

### 6.1 이름 맞추기 (`NameGame.jsx`)
- 캔버스 2개(이미지/마스크)로 이미지 일부만 공개
- 클릭 시 마스크 제거(원형)
- 정답 입력/스킵/통계 요약 제공

### 6.2 스도쿠 (`SudokuGame.jsx`)
- `sudokuUtils.js`에서 퍼즐 생성 및 검증
- 난이도/크기 선택
- 이미지 팔레트 선택으로 보드 채우기

### 6.3 퍼즐 맞추기 (`PuzzleGame.jsx`)
- 이미지 1개 선택 시 즉시 퍼즐 시작
- 퍼즐 조각은 캔버스로 생성(지그재그 모양)
- 스냅 거리 내에 놓으면 자동 정렬
- 완성 시 토스트 메시지 후 자동 초기화
- 퍼즐 시작 시 해당 영역으로 자동 스크롤

## 7. 스타일 구조
- 모든 스타일은 `src/index.css`에 집중
- 공통 컴포넌트 스타일(버튼, 카드, 토스트 등)과 게임별 스타일이 공존
- 퍼즐 관련 클래스는 `puzzle-` prefix 사용

## 8. 실행 방법
```bash
npm install
npm run dev
```

## 9. 배포 (GitHub Pages)
```bash
npm run deploy
```
- `vite.config.js`의 `base` 설정이 리포지토리 이름과 맞아야 함

## 10. 새로운 게임 추가 가이드
1. `src/`에 새 게임 컴포넌트 추가 (예: `NewGame.jsx`)
2. `src/App.jsx`에 라우트 및 메뉴 추가
3. `src/index.css`에 스타일 추가(접두어 사용 권장)
4. 공통 이미지 데이터 사용 시 `mapping.json`에서 이미지 로딩

## 11. 에이전트 참고사항
- 게임 선택은 반드시 라우팅에 반영
- 이미지 경로는 `resolveAssetPath`로 처리
- 퍼즐/스도쿠는 반응형 레이아웃에 민감하므로 스타일 변경 시 화면 확인 필요
- 토스트 메시지는 공통 클래스(`.toast`)를 사용

---
문서 개선이 필요하면 언제든 업데이트하세요.

# TinyPing Games

티니핑 캐릭터를 활용한 두 가지 게임을 제공합니다.

## 게임 종류

### 1. 이름 맞추기 게임
이미지를 클릭해서 영역을 조금씩 열어보고, 몇 번 만에 맞히는지 기록해보세요.

**기능:**
- 클릭으로 이미지 영역 점진적 공개
- 정답 시 자동 진행
- 라운드 스킵 지원
- 최근 10라운드 통계 요약
- 정답 알림 토스트

### 2. 스도쿠 게임
숫자 대신 티니핑 이미지로 스도쿠를 풀어보세요. 각 이미지는 정확히 9번 사용됩니다.

**기능:**
- 9개의 랜덤 이미지로 스도쿠 풀기
- 초급/중급/고급 난이도 선택
- 이미지 팔레트에서 선택하여 입력
- 이미지 사용 횟수 추적 (9번 사용 시 딤드 처리)
- 실시간 보드 검증 및 완성 감지

## Local development
```bash
npm install
npm run dev
```

## Build and preview
```bash
npm run build
npm run preview
```

## GitHub Pages deployment
This project uses `gh-pages` for deployment.

```bash
npm run deploy
```

After the first deploy, set GitHub Pages Source to the `gh-pages` branch.

## 프로젝트 구조
- `src/App.jsx` - 메인 라우터 (게임 선택 메뉴)
- `src/NameGame.jsx` - 이름 맞추기 게임
- `src/SudokuGame.jsx` - 스도쿠 게임
- `src/sudokuUtils.js` - 스도쿠 생성 및 검증 로직
- `public/data/mapping.json` - 이미지 매핑 데이터
- `public/images/` - 게임 이미지 파일

## Notes
- Static assets live in `public/data` and `public/images`.
- If the repo name changes, update `base` in `vite.config.js`.
- 스도쿠 게임은 게임 시작 시마다 9개의 이미지를 랜덤으로 선택합니다.
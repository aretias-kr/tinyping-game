# TinyPing Guess Game

Guess the TinyPing character name by revealing small parts of the image. Each
round tracks clicks and wrong answers, supports skip, and shows a summary every
10 rounds.

## Features
- Click-to-reveal image mask
- Auto-advance on correct answer
- Skip round support
- Rolling stats for the last 10 rounds
- Toast-style correct answer alert

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

## Notes
- Static assets live in `public/data` and `public/images`.
- If the repo name changes, update `base` in `vite.config.js`.

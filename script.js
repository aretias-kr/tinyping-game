const imageCanvas = document.getElementById("imageCanvas");
const maskCanvas = document.getElementById("maskCanvas");
const imageCtx = imageCanvas.getContext("2d");
const maskCtx = maskCanvas.getContext("2d");

const clickCountEl = document.getElementById("clickCount");
const roundIndexEl = document.getElementById("roundIndex");
const guessInput = document.getElementById("guessInput");
const submitBtn = document.getElementById("submitBtn");
const skipBtn = document.getElementById("skipBtn");
const feedback = document.getElementById("feedback");
const seasonSelect = document.getElementById("seasonSelect");
const summary = document.getElementById("summary");
const toast = document.getElementById("toast");

const state = {
  mapping: [],
  order: [],
  currentIndex: 0,
  clickCount: 0,
  current: null,
  revealed: false,
  view: { width: 0, height: 0 },
  dimAlpha: 1,
  maskBase: null,
  maskBaseCtx: null,
  roundWrongs: 0,
  recentStats: [],
  toastTimer: null,
};

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/\s+/g, "");
}

function displayName(entry) {
  return entry.name_ko || entry.name || entry.name_en || "";
}

function resizeCanvases() {
  const rect = imageCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.view.width = rect.width;
  state.view.height = rect.height;

  [imageCanvas, maskCanvas].forEach((canvas) => {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  });

  imageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!state.maskBase) {
    state.maskBase = document.createElement("canvas");
    state.maskBaseCtx = state.maskBase.getContext("2d");
  }
  state.maskBase.width = rect.width * dpr;
  state.maskBase.height = rect.height * dpr;
  state.maskBaseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCoverImage(img) {
  const { width, height } = state.view;
  imageCtx.clearRect(0, 0, width, height);

  const imgRatio = img.width / img.height;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    offsetY = (height - drawHeight) / 2;
  }

  imageCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function resetMask() {
  const { width, height } = state.view;
  state.maskBaseCtx.clearRect(0, 0, width, height);
  state.maskBaseCtx.globalCompositeOperation = "source-over";
  state.maskBaseCtx.fillStyle = "rgba(255, 255, 255, 1)";
  state.maskBaseCtx.fillRect(0, 0, width, height);
  applyDimAlpha();
}

function applyDimAlpha() {
  const { width, height } = state.view;
  const alpha = state.dimAlpha;
  maskCtx.save();
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.clearRect(0, 0, width, height);
  maskCtx.drawImage(state.maskBase, 0, 0, width, height);
  maskCtx.globalCompositeOperation = "source-in";
  const gradient = maskCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `rgba(255, 241, 228, ${alpha})`);
  gradient.addColorStop(1, `rgba(255, 223, 200, ${alpha})`);
  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, width, height);
  maskCtx.restore();
}

function revealAt(x, y) {
  const radius = Math.max(24, Math.min(state.view.width, state.view.height) * 0.06);
  state.maskBaseCtx.save();
  state.maskBaseCtx.globalCompositeOperation = "destination-out";
  state.maskBaseCtx.beginPath();
  state.maskBaseCtx.arc(x, y, radius, 0, Math.PI * 2);
  state.maskBaseCtx.fill();
  state.maskBaseCtx.restore();
  applyDimAlpha();
}

function revealAll() {
  state.maskBaseCtx.clearRect(0, 0, state.view.width, state.view.height);
  applyDimAlpha();
}

function updateStats() {
  clickCountEl.textContent = state.clickCount;
  const total = state.order.length || 0;
  const current = total ? state.currentIndex + 1 : 0;
  roundIndexEl.textContent = `${current} / ${total}`;
}

function showToast(message) {
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }
  state.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1400);
}

function loadCurrentImage() {
  if (!state.order.length) {
    resizeCanvases();
    imageCtx.clearRect(0, 0, state.view.width, state.view.height);
    maskCtx.clearRect(0, 0, state.view.width, state.view.height);
    feedback.textContent = "선택한 시즌에 문제가 없어요.";
    state.current = null;
    updateStats();
    updateSummary();
    return;
  }
  const entry = state.mapping[state.order[state.currentIndex]];
  state.current = entry;
  state.clickCount = 0;
  state.revealed = false;
  state.roundWrongs = 0;
  guessInput.value = "";
  updateStats();
  feedback.textContent = "이미지를 클릭해서 조금씩 확인해 보세요.";

  const img = new Image();
  img.onload = () => {
    resizeCanvases();
    drawCoverImage(img);
    resetMask();
  };
  img.src = entry.file;
}

function nextRound() {
  if (state.currentIndex >= state.order.length - 1) {
    feedback.textContent = "모든 문제를 완료했어요! 새로고침하면 다시 시작합니다.";
    state.revealed = true;
    revealAll();
    return;
  }
  state.currentIndex += 1;
  loadCurrentImage();
}

maskCanvas.addEventListener("click", (event) => {
  if (!state.current || state.revealed) {
    return;
  }
  const rect = maskCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  revealAt(x, y);
  state.clickCount += 1;
  updateStats();
});

submitBtn.addEventListener("click", () => {
  if (!state.current) {
    return;
  }
  const guess = normalizeName(guessInput.value.trim());
  if (!guess) {
    feedback.textContent = "이름을 입력해 주세요.";
    return;
  }
  const answer = normalizeName(displayName(state.current));
  if (guess === answer) {
    state.revealed = true;
    revealAll();
    recordRound({ skipped: false });
    feedback.textContent = "정답입니다!";
    showToast("정답입니다!");
    setTimeout(() => {
      nextRound();
    }, 400);
  } else {
    state.roundWrongs += 1;
    feedback.textContent = "아쉽지만 틀렸어요. 다시 도전!";
  }
});

skipBtn.addEventListener("click", () => {
  if (!state.current) {
    return;
  }
  state.revealed = true;
  revealAll();
  recordRound({ skipped: true });
  nextRound();
});

guessInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitBtn.click();
  }
});

seasonSelect.addEventListener("change", () => {
  buildOrder();
});

function recordRound({ skipped }) {
  state.recentStats.push({
    clicks: state.clickCount,
    wrongs: state.roundWrongs,
    skipped,
  });
  updateSummary();
}

function updateSummary() {
  if (!summary) {
    return;
  }
  if (state.recentStats.length < 10) {
    summary.textContent = "";
    return;
  }
  const recent = state.recentStats.slice(-10);
  const totalClicks = recent.reduce((sum, item) => sum + item.clicks, 0);
  const totalWrongs = recent.reduce((sum, item) => sum + item.wrongs, 0);
  const totalSkips = recent.reduce((sum, item) => sum + (item.skipped ? 1 : 0), 0);
  summary.textContent = `최근 10문제: 클릭 ${totalClicks}회, 오답 ${totalWrongs}회, SKIP ${totalSkips}회`;
}

window.addEventListener("resize", () => {
  if (!state.current) {
    return;
  }
  const img = new Image();
  img.onload = () => {
    resizeCanvases();
    drawCoverImage(img);
    resetMask();
  };
  img.src = state.current.file;
});

fetch("data/mapping.json")
  .then((res) => res.json())
  .then((data) => {
    state.mapping = data;
    setupSeasonOptions();
    buildOrder();
  })
  .catch(() => {
    feedback.textContent = "데이터를 불러오지 못했어요. 서버 실행 여부를 확인해 주세요.";
  });

function setupSeasonOptions() {
  const seasons = Array.from(
    new Set(
      state.mapping
        .map((item) => item.season)
        .filter((value) => Number.isFinite(value))
    )
  ).sort((a, b) => a - b);

  seasons.forEach((season) => {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = `시즌 ${season}`;
    seasonSelect.appendChild(option);
  });

  const hasUnknown = state.mapping.some((item) => !Number.isFinite(item.season));
  if (hasUnknown) {
    const option = document.createElement("option");
    option.value = "unknown";
    option.textContent = "시즌 알 수 없음";
    seasonSelect.appendChild(option);
  }
}

function buildOrder() {
  let pool = state.mapping.map((_, index) => index);
  const selected = seasonSelect.value;
  if (selected !== "all") {
    if (selected === "unknown") {
      pool = pool.filter((index) => !Number.isFinite(state.mapping[index].season));
    } else {
      const target = Number(selected);
      pool = pool.filter((index) => state.mapping[index].season === target);
    }
  }
  state.order = shuffle(pool);
  state.currentIndex = 0;
  state.recentStats = [];
  state.roundWrongs = 0;
  updateSummary();
  loadCurrentImage();
}

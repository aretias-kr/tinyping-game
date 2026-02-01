import { useCallback, useEffect, useRef, useState } from "react";

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function displayName(entry) {
  return entry?.name_ko || entry?.name || entry?.name_en || "";
}

const baseUrl = import.meta.env.BASE_URL;

function resolveAssetPath(path) {
  if (!path) {
    return "";
  }
  if (path.startsWith("/") || path.startsWith("http") || path.startsWith("data:")) {
    if (path.startsWith("/")) {
      return `${baseUrl}${path.slice(1)}`;
    }
    return path;
  }
  return `${baseUrl}${path}`;
}

export default function NameGame() {
  const imageCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const imageCtxRef = useRef(null);
  const maskCtxRef = useRef(null);

  const [clickCount, setClickCount] = useState(0);
  const [roundIndexText, setRoundIndexText] = useState("0 / 0");
  const [feedback, setFeedback] = useState("이미지를 클릭해서 영역을 조금씩 확인해보세요.");
  const [summaryStats, setSummaryStats] = useState(null);
  const [guess, setGuess] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [mappingReady, setMappingReady] = useState(false);

  const stateRef = useRef({
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
  });
  const hintTimerRef = useRef(null);

  const updateStats = useCallback(() => {
    const state = stateRef.current;
    setClickCount(state.clickCount);
    const total = state.order.length || 0;
    const current = total ? state.currentIndex + 1 : 0;
    setRoundIndexText(`${current} / ${total}`);
  }, []);

  const updateSummary = useCallback(() => {
    const { recentStats } = stateRef.current;
    if (recentStats.length < 10) {
      setSummaryStats(null);
      return;
    }
    const recent = recentStats.slice(-10);
    const totalClicks = recent.reduce((sum, item) => sum + item.clicks, 0);
    const totalWrongs = recent.reduce((sum, item) => sum + item.wrongs, 0);
    const totalSkips = recent.reduce((sum, item) => sum + (item.skipped ? 1 : 0), 0);
    const totalRounds = recent.length;
    const correctRounds = totalRounds - totalSkips;
    const accuracy = totalRounds ? Math.round((correctRounds / totalRounds) * 100) : 0;
    const avgClicks = totalRounds ? (totalClicks / totalRounds).toFixed(1) : "0.0";
    let gradeKey = "try";
    let gradeLabel = "리트라이";
    if (accuracy === 100 && totalWrongs === 0) {
      gradeKey = "perfect";
      gradeLabel = "퍼펙트";
    } else if (accuracy >= 90) {
      gradeKey = "excellent";
      gradeLabel = "엑설런트";
    } else if (accuracy >= 70) {
      gradeKey = "good";
      gradeLabel = "굿";
    }
    setSummaryStats({
      totalClicks,
      totalWrongs,
      totalSkips,
      totalRounds,
      correctRounds,
      accuracy,
      avgClicks,
      gradeKey,
      gradeLabel,
    });
  }, []);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    const state = stateRef.current;
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    state.toastTimer = setTimeout(() => {
      setToastVisible(false);
    }, 1400);
  }, []);

  const scheduleHintAutoHide = useCallback(() => {
    setHintVisible(true);
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = setTimeout(() => {
      setHintVisible(false);
    }, 3000);
  }, []);

  const resizeCanvases = useCallback(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const imageCtx = imageCtxRef.current;
    const maskCtx = maskCtxRef.current;

    if (!imageCanvas || !maskCanvas || !imageCtx || !maskCtx) {
      return;
    }

    const rect = imageCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const view = stateRef.current.view;
    view.width = rect.width;
    view.height = rect.height;

    [imageCanvas, maskCanvas].forEach((canvas) => {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    });

    imageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!stateRef.current.maskBase) {
      stateRef.current.maskBase = document.createElement("canvas");
      stateRef.current.maskBaseCtx = stateRef.current.maskBase.getContext("2d");
    }
    stateRef.current.maskBase.width = rect.width * dpr;
    stateRef.current.maskBase.height = rect.height * dpr;
    stateRef.current.maskBaseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const drawCoverImage = useCallback((img) => {
    const { width, height } = stateRef.current.view;
    const imageCtx = imageCtxRef.current;

    if (!imageCtx) {
      return;
    }

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
  }, []);

  const applyDimAlpha = useCallback(() => {
    const { width, height } = stateRef.current.view;
    const maskCtx = maskCtxRef.current;
    const maskBase = stateRef.current.maskBase;

    if (!maskCtx || !maskBase) {
      return;
    }

    const alpha = stateRef.current.dimAlpha;
    maskCtx.save();
    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.drawImage(maskBase, 0, 0, width, height);
    maskCtx.globalCompositeOperation = "source-in";
    const gradient = maskCtx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `rgba(255, 241, 228, ${alpha})`);
    gradient.addColorStop(1, `rgba(255, 223, 200, ${alpha})`);
    maskCtx.fillStyle = gradient;
    maskCtx.fillRect(0, 0, width, height);
    maskCtx.restore();
  }, []);

  const resetMask = useCallback(() => {
    const { width, height } = stateRef.current.view;
    const maskBaseCtx = stateRef.current.maskBaseCtx;

    if (!maskBaseCtx) {
      return;
    }

    maskBaseCtx.clearRect(0, 0, width, height);
    maskBaseCtx.globalCompositeOperation = "source-over";
    maskBaseCtx.fillStyle = "rgba(255, 255, 255, 1)";
    maskBaseCtx.fillRect(0, 0, width, height);
    applyDimAlpha();
  }, [applyDimAlpha]);

  const revealAt = useCallback(
    (x, y) => {
      const { width, height } = stateRef.current.view;
      const maskBaseCtx = stateRef.current.maskBaseCtx;

      if (!maskBaseCtx) {
        return;
      }

      const radius = Math.max(24, Math.min(width, height) * 0.06);
      maskBaseCtx.save();
      maskBaseCtx.globalCompositeOperation = "destination-out";
      maskBaseCtx.beginPath();
      maskBaseCtx.arc(x, y, radius, 0, Math.PI * 2);
      maskBaseCtx.fill();
      maskBaseCtx.restore();
      applyDimAlpha();
    },
    [applyDimAlpha],
  );

  const revealAll = useCallback(() => {
    const { width, height } = stateRef.current.view;
    const maskBaseCtx = stateRef.current.maskBaseCtx;

    if (!maskBaseCtx) {
      return;
    }

    maskBaseCtx.clearRect(0, 0, width, height);
    applyDimAlpha();
  }, [applyDimAlpha]);

  const loadCurrentImage = useCallback(() => {
    const state = stateRef.current;
    const imageCtx = imageCtxRef.current;
    const maskCtx = maskCtxRef.current;

    if (!state.order.length) {
      resizeCanvases();
      if (imageCtx) {
        imageCtx.clearRect(0, 0, state.view.width, state.view.height);
      }
      if (maskCtx) {
        maskCtx.clearRect(0, 0, state.view.width, state.view.height);
      }
      setFeedback("선택한 시즌에 문제가 없어요.");
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
    setGuess("");
    updateStats();
    setFeedback("이미지를 클릭해서 영역을 조금씩 확인해보세요.");

    const img = new Image();
    img.onload = () => {
      resizeCanvases();
      drawCoverImage(img);
      resetMask();
    };
    img.src = resolveAssetPath(entry.file);
  }, [drawCoverImage, resetMask, resizeCanvases, updateStats, updateSummary]);

  const recordRound = useCallback(
    ({ skipped }) => {
      stateRef.current.recentStats.push({
        clicks: stateRef.current.clickCount,
        wrongs: stateRef.current.roundWrongs,
        skipped,
      });
      updateSummary();
    },
    [updateSummary],
  );

  const nextRound = useCallback(() => {
    const state = stateRef.current;
    if (state.currentIndex >= state.order.length - 1) {
      setFeedback("모든 문제를 완료했어요. 새로고침하면 다시 시작합니다.");
      state.revealed = true;
      revealAll();
      return;
    }
    state.currentIndex += 1;
    loadCurrentImage();
  }, [loadCurrentImage, revealAll]);

  const buildOrder = useCallback(() => {
    const pool = stateRef.current.mapping.map((_, index) => index);
    stateRef.current.order = shuffle(pool);
    stateRef.current.currentIndex = 0;
    stateRef.current.recentStats = [];
    stateRef.current.roundWrongs = 0;
    updateSummary();
    loadCurrentImage();
  }, [loadCurrentImage, updateSummary]);

  const handleCanvasClick = useCallback(
    (event) => {
      const state = stateRef.current;
      if (!state.current || state.revealed) {
        return;
      }
      setHintVisible(false);
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      revealAt(x, y);
      state.clickCount += 1;
      updateStats();
    },
    [revealAt, updateStats],
  );

  const handleSubmit = useCallback(() => {
    const state = stateRef.current;
    if (!state.current) {
      return;
    }
    const trimmed = guess.trim();
    if (!trimmed) {
      setFeedback("이름을 입력해 주세요.");
      return;
    }
    const answer = normalizeName(displayName(state.current));
    const normalizedGuess = normalizeName(trimmed);
    if (normalizedGuess === answer) {
      state.revealed = true;
      revealAll();
      recordRound({ skipped: false });
      setFeedback("정답입니다!");
      showToast("정답입니다!");
      setTimeout(() => {
        nextRound();
      }, 400);
    } else {
      state.roundWrongs += 1;
      setFeedback("아쉽지만 틀렸어요. 다시 도전!");
    }
  }, [guess, nextRound, recordRound, revealAll, showToast]);

  const handleSkip = useCallback(() => {
    const state = stateRef.current;
    if (!state.current) {
      return;
    }
    state.revealed = true;
    revealAll();
    recordRound({ skipped: true });
    nextRound();
  }, [nextRound, recordRound, revealAll]);

  const handleRestart = useCallback(() => {
    if (!stateRef.current.mapping.length) {
      return;
    }
    buildOrder();
  }, [buildOrder]);

  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (imageCanvas) {
      imageCtxRef.current = imageCanvas.getContext("2d");
    }
    if (maskCanvas) {
      maskCtxRef.current = maskCanvas.getContext("2d");
    }
  }, []);

  useEffect(() => {
    fetch(`${baseUrl}data/mapping.json`)
      .then((res) => res.json())
      .then((data) => {
        stateRef.current.mapping = data;
        setMappingReady(true);
      })
      .catch(() => {
        setFeedback("데이터를 불러오지 못했어요. 서버 실행 여부를 확인해 주세요.");
      });
  }, []);

  useEffect(() => {
    if (!mappingReady || !stateRef.current.mapping.length) {
      return;
    }
    buildOrder();
  }, [buildOrder, mappingReady]);

  useEffect(() => {
    const handleResize = () => {
      scheduleHintAutoHide();
      const state = stateRef.current;
      if (!state.current) {
        return;
      }
      const prevView = { width: state.view.width, height: state.view.height };
      const prevMask = state.maskBase;
      let snapshot = null;
      if (prevMask && prevView.width && prevView.height) {
        snapshot = document.createElement("canvas");
        snapshot.width = prevMask.width;
        snapshot.height = prevMask.height;
        const snapshotCtx = snapshot.getContext("2d");
        snapshotCtx.drawImage(prevMask, 0, 0);
      }
      const img = new Image();
      img.onload = () => {
        resizeCanvases();
        drawCoverImage(img);
        if (snapshot && state.maskBaseCtx) {
          state.maskBaseCtx.save();
          state.maskBaseCtx.globalCompositeOperation = "source-over";
          state.maskBaseCtx.drawImage(
            snapshot,
            0,
            0,
            snapshot.width,
            snapshot.height,
            0,
            0,
            state.view.width,
            state.view.height,
          );
          state.maskBaseCtx.restore();
          applyDimAlpha();
        } else {
          resetMask();
        }
      };
      img.src = resolveAssetPath(state.current.file);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [drawCoverImage, resetMask, resizeCanvases, scheduleHintAutoHide]);

  useEffect(() => {
    const handleScroll = () => {
      scheduleHintAutoHide();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scheduleHintAutoHide]);

  return (
    <>
      <main className="page">
        <header className="hero">
          <div className="hero-text">
            <p className="eyebrow">TinyPing Guess</p>
            <h1>티니핑 이름 맞추기</h1>
            <p className="sub">
              이미지를 클릭해서 영역을 조금씩 열어보고, 몇 번 만에 맞히는지
              기록해보세요.
            </p>
          </div>
          <div className="hero-panel">
            <div className="stats">
              <div>
                <span className="label">클릭 수</span>
                <span className="value">{clickCount}</span>
              </div>
              <div>
                <span className="label">현재 문제</span>
                <span className="value">{roundIndexText}</span>
              </div>
            </div>
            <div className="controls">
              <input
                type="text"
                value={guess}
                placeholder="이름을 입력해 주세요"
                autoComplete="off"
                onChange={(event) => setGuess(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
              <button type="button" onClick={handleSubmit}>
                정답 제출
              </button>
              <button type="button" className="ghost" onClick={handleSkip}>
                SKIP
              </button>
            </div>
            <p className="feedback">{feedback}</p>
            {summaryStats ? (
              <section className="summary-card" aria-live="polite">
                <div className="summary-header">
                  <div>
                    <p className="summary-eyebrow">라운드 클리어</p>
                    <h3>10문제 완료</h3>
                    <p className="summary-note">다음 10문제를 계속 진행합니다.</p>
                  </div>
                  <span className={`summary-badge ${summaryStats.gradeKey}`}>
                    {summaryStats.gradeLabel}
                  </span>
                </div>
                <div className="summary-metrics">
                  <div className="metric">
                    <span className="metric-label">클릭 합계</span>
                    <span className="metric-value">{summaryStats.totalClicks}회</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">평균 클릭</span>
                    <span className="metric-value">{summaryStats.avgClicks}회</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">오답</span>
                    <span className="metric-value">{summaryStats.totalWrongs}회</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">SKIP</span>
                    <span className="metric-value">{summaryStats.totalSkips}회</span>
                  </div>
                </div>
                <div className="summary-bar">
                  <span className="summary-bar-label">
                    정답 {summaryStats.correctRounds}/{summaryStats.totalRounds} · 정확도{" "}
                    {summaryStats.accuracy}%
                  </span>
                  <div className="summary-bar-track">
                    <div
                      className="summary-bar-fill"
                      style={{ width: `${summaryStats.accuracy}%` }}
                    />
                  </div>
                </div>
                <div className="summary-actions">
                  <button type="button" className="ghost summary-restart" onClick={handleRestart}>
                    다시 시작
                  </button>
                </div>
              </section>
            ) : (
              <p className="summary hint">10문제를 완료하면 요약 카드가 표시됩니다.</p>
            )}
          </div>
        </header>

        <section className="board">
          <div className="canvas-wrap">
            <canvas ref={imageCanvasRef} width="720" height="720" />
            <canvas ref={maskCanvasRef} width="720" height="720" onClick={handleCanvasClick} />
            <div className={`canvas-hint${hintVisible ? " show" : ""}`}>
              클릭해서 영역을 열어보세요
            </div>
          </div>
        </section>
      </main>

      <div
        className={`toast${toastVisible ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </>
  );
}

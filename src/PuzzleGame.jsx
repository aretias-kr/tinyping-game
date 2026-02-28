import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeCoverRect(img, width, height) {
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

  return { offsetX, offsetY, drawWidth, drawHeight };
}

function drawJigsawPath(ctx, size, tabSize, tabs) {
  const s = size;
  const t = tabSize;
  const third = s / 3;
  const x = t;
  const y = t;

  ctx.beginPath();
  ctx.moveTo(x, y);

  // Top
  ctx.lineTo(x + third, y);
  if (tabs.top !== 0) {
    ctx.bezierCurveTo(
      x + third,
      y - tabs.top * t,
      x + 2 * third,
      y - tabs.top * t,
      x + 2 * third,
      y,
    );
  }
  ctx.lineTo(x + s, y);

  // Right
  ctx.lineTo(x + s, y + third);
  if (tabs.right !== 0) {
    ctx.bezierCurveTo(
      x + s + tabs.right * t,
      y + third,
      x + s + tabs.right * t,
      y + 2 * third,
      x + s,
      y + 2 * third,
    );
  }
  ctx.lineTo(x + s, y + s);

  // Bottom
  ctx.lineTo(x + 2 * third, y + s);
  if (tabs.bottom !== 0) {
    ctx.bezierCurveTo(
      x + 2 * third,
      y + s + tabs.bottom * t,
      x + third,
      y + s + tabs.bottom * t,
      x + third,
      y + s,
    );
  }
  ctx.lineTo(x, y + s);

  // Left
  ctx.lineTo(x, y + 2 * third);
  if (tabs.left !== 0) {
    ctx.bezierCurveTo(
      x - tabs.left * t,
      y + 2 * third,
      x - tabs.left * t,
      y + third,
      x,
      y + third,
    );
  }
  ctx.lineTo(x, y);

  ctx.closePath();
}

function computeSourceRect(piece, image) {
  const scaleX = image.width / piece.cover.drawWidth;
  const scaleY = image.height / piece.cover.drawHeight;

  const desiredX = piece.correctX - piece.tabSize;
  const desiredY = piece.correctY - piece.tabSize;
  const desiredW = piece.size + piece.tabSize * 2;
  const desiredH = piece.size + piece.tabSize * 2;

  let sx = (desiredX - piece.cover.offsetX) * scaleX;
  let sy = (desiredY - piece.cover.offsetY) * scaleY;
  let sw = desiredW * scaleX;
  let sh = desiredH * scaleY;

  let dx = 0;
  let dy = 0;
  let dw = piece.width;
  let dh = piece.height;

  if (sx < 0) {
    const crop = -sx;
    const ratio = crop / sw;
    dx += dw * ratio;
    dw -= dw * ratio;
    sw -= crop;
    sx = 0;
  }
  if (sy < 0) {
    const crop = -sy;
    const ratio = crop / sh;
    dy += dh * ratio;
    dh -= dh * ratio;
    sh -= crop;
    sy = 0;
  }
  if (sx + sw > image.width) {
    const crop = sx + sw - image.width;
    const ratio = crop / sw;
    dw -= dw * ratio;
    sw -= crop;
  }
  if (sy + sh > image.height) {
    const crop = sy + sh - image.height;
    const ratio = crop / sh;
    dh -= dh * ratio;
    sh -= crop;
  }

  return { sx, sy, sw, sh, dx, dy, dw, dh };
}

function createTabs(rows, cols) {
  const tabs = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = tabs[row][col];
      if (row === 0) {
        cell.top = 0;
      } else {
        cell.top = -tabs[row - 1][col].bottom;
      }
      if (col === 0) {
        cell.left = 0;
      } else {
        cell.left = -tabs[row][col - 1].right;
      }
      if (col === cols - 1) {
        cell.right = 0;
      } else {
        cell.right = Math.random() > 0.5 ? 1 : -1;
      }
      if (row === rows - 1) {
        cell.bottom = 0;
      } else {
        cell.bottom = Math.random() > 0.5 ? 1 : -1;
      }
    }
  }

  return tabs;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PuzzleBoard({ entry, size, onComplete, boardIndex }) {
  const cardRef = useRef(null);
  const fieldRef = useRef(null);
  const boardRef = useRef(null);
  const canvasRefs = useRef(new Map());
  const layoutRef = useRef(null);
  const dragRef = useRef(null);
  const zIndexRef = useRef(1);

  const [layout, setLayout] = useState(null);
  const [image, setImage] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const completionRef = useRef(false);
  const allowRebuildRef = useRef(true);

  const imagePath = useMemo(() => resolveAssetPath(entry.file), [entry.file]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imagePath;
  }, [imagePath]);

  useLayoutEffect(() => {
    if (!cardRef.current || !boardRef.current || !fieldRef.current) {
      return;
    }

    const updateLayout = () => {
      const cardRect = cardRef.current.getBoundingClientRect();
      const fieldRect = fieldRef.current.getBoundingClientRect();
      const boardRect = boardRef.current.getBoundingClientRect();
      const nextLayout = {
        card: cardRect,
        field: {
          x: fieldRect.left - cardRect.left,
          y: fieldRect.top - cardRect.top,
          width: fieldRect.width,
          height: fieldRect.height,
        },
        board: {
          x: boardRect.left - cardRect.left,
          y: boardRect.top - cardRect.top,
          width: boardRect.width,
          height: boardRect.height,
        },
      };
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(cardRef.current);
    observer.observe(fieldRef.current);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  const buildPuzzle = useCallback(() => {
    if (!image || !layoutRef.current) {
      return;
    }
    if (!allowRebuildRef.current) {
      return;
    }
    const { board, field } = layoutRef.current;
    if (!board.width || !field.width) {
      return;
    }

    const boardSize = Math.min(board.width, board.height);
    const pieceSize = boardSize / size;
    const tabSize = pieceSize * 0.24;
    const tabs = createTabs(size, size);
    const cover = computeCoverRect(image, boardSize, boardSize);

    const pieceWidth = pieceSize + tabSize * 2;
    const pieceHeight = pieceSize + tabSize * 2;
    const gap = Math.max(12, pieceSize * 0.1);

    const areas = [];
    const leftWidth = board.x - field.x - gap;
    const rightWidth = field.x + field.width - (board.x + board.width) - gap;
    const bottomHeight = field.y + field.height - (board.y + board.height) - gap;

    if (leftWidth >= pieceWidth) {
      areas.push({
        x: field.x + gap,
        y: field.y + gap,
        width: leftWidth - gap,
        height: field.height - gap * 2,
      });
    }
    if (rightWidth >= pieceWidth) {
      areas.push({
        x: board.x + board.width + gap,
        y: field.y + gap,
        width: rightWidth - gap,
        height: field.height - gap * 2,
      });
    }
    if (bottomHeight >= pieceHeight) {
      areas.push({
        x: field.x + gap,
        y: board.y + board.height + gap,
        width: field.width - gap * 2,
        height: bottomHeight - gap,
      });
    }

    const bottomOnly = areas.length === 1 && areas[0].y > board.y + board.height;

    zIndexRef.current = 1;

    const nextPieces = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const correctX = col * pieceSize;
        const correctY = row * pieceSize;

        const targetX = board.x + correctX - tabSize;
        const targetY = board.y + correctY - tabSize;

        let startX = targetX;
        let startY = targetY;
        if (areas.length > 0 && !bottomOnly) {
          const area = areas[Math.floor(Math.random() * areas.length)];
          const maxX = area.x + area.width - pieceWidth;
          const maxY = area.y + area.height - pieceHeight;
          const minX = area.x;
          const minY = area.y;
          startX = clamp(minX + Math.random() * (maxX - minX), minX, maxX);
          startY = clamp(minY + Math.random() * (maxY - minY), minY, maxY);
        } else {
          const fallback = areas[0] || {
            x: field.x + gap,
            y: board.y + board.height + gap,
            width: field.width - gap * 2,
            height: Math.max(pieceHeight + gap, field.height - board.y - board.height - gap),
          };
          const maxX = fallback.x + fallback.width - pieceWidth;
          const maxY = fallback.y + fallback.height - pieceHeight;
          const minX = fallback.x;
          const minY = fallback.y;
          startX = clamp(minX + Math.random() * (maxX - minX), minX, maxX);
          startY = clamp(minY + Math.random() * (maxY - minY), minY, maxY);
        }

        nextPieces.push({
          id: `${boardIndex}-${row}-${col}`,
          row,
          col,
          tabs: tabs[row][col],
          size: pieceSize,
          tabSize,
          width: pieceWidth,
          height: pieceHeight,
          correctX,
          correctY,
          targetX,
          targetY,
          x: startX,
          y: startY,
          placed: false,
          groupId: `${boardIndex}-${row}-${col}`,
          z: zIndexRef.current,
          cover,
          boardSize,
        });
        zIndexRef.current += 1;
      }
    }

    setPieces(shuffle(nextPieces));
    setIsComplete(false);
    setSuccessMessage("");
    completionRef.current = false;
    allowRebuildRef.current = true;
  }, [image, size, boardIndex]);

  useEffect(() => {
    buildPuzzle();
  }, [buildPuzzle, layout]);

  useEffect(() => {
    if (!image) {
      return;
    }
    pieces.forEach((piece) => {
      const canvas = canvasRefs.current.get(piece.id);
      if (!canvas) {
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = piece.width * dpr;
      canvas.height = piece.height * dpr;
      canvas.style.width = `${piece.width}px`;
      canvas.style.height = `${piece.height}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, piece.width, piece.height);

      drawJigsawPath(ctx, piece.size, piece.tabSize, piece.tabs);
      ctx.save();
      ctx.fillStyle = "#fff7f0";
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.clip();

      const sourceRect = computeSourceRect(piece, image);
      ctx.drawImage(
        image,
        sourceRect.sx,
        sourceRect.sy,
        sourceRect.sw,
        sourceRect.sh,
        sourceRect.dx,
        sourceRect.dy,
        sourceRect.dw,
        sourceRect.dh,
      );
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(28, 26, 26, 0.2)";
      drawJigsawPath(ctx, piece.size, piece.tabSize, piece.tabs);
      ctx.stroke();
      ctx.restore();
    });
  }, [pieces, image]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragRef.current || !layoutRef.current) {
        return;
      }
      const { id, offsetX, offsetY, groupId } = dragRef.current;
      const cardRect = layoutRef.current.card;
      const pointerX = event.clientX - cardRect.left;
      const pointerY = event.clientY - cardRect.top;
      setPieces((prev) => {
        const anchor = prev.find((piece) => piece.id === id);
        if (!anchor) {
          return prev;
        }
        const nextX = pointerX - offsetX;
        const nextY = pointerY - offsetY;
        const dx = nextX - anchor.x;
        const dy = nextY - anchor.y;
        return prev.map((piece) =>
          piece.groupId === groupId
            ? { ...piece, x: piece.x + dx, y: piece.y + dy }
            : piece,
        );
      });
    };

    const handlePointerUp = () => {
      if (!dragRef.current) {
        return;
      }
      const { id, groupId } = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);

      setPieces((prev) => {
        const pieces = prev.map((piece) => ({ ...piece }));
        const byId = new Map(pieces.map((piece) => [piece.id, piece]));
        const byPos = new Map(
          pieces.map((piece) => [`${piece.row}-${piece.col}`, piece]),
        );

        const groupPieces = pieces.filter((piece) => piece.groupId === groupId);
        if (!groupPieces.length) {
          return prev;
        }

        const anchor = byId.get(id) || groupPieces[0];
        const snapDistance = Math.max(18, anchor.size * 0.2);

        // Snap group to target if all deltas line up
        const deltaX = anchor.targetX - anchor.x;
        const deltaY = anchor.targetY - anchor.y;
        const groupAligned = groupPieces.every(
          (piece) =>
            Math.abs(piece.targetX - piece.x - deltaX) <= 3 &&
            Math.abs(piece.targetY - piece.y - deltaY) <= 3,
        );
        if (Math.hypot(deltaX, deltaY) <= snapDistance && groupAligned) {
          groupPieces.forEach((piece) => {
            piece.x += deltaX;
            piece.y += deltaY;
            piece.placed = true;
          });
        }

        const directions = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
        ];

        const groupHasPlaced = new Map();
        pieces.forEach((piece) => {
          if (!groupHasPlaced.has(piece.groupId)) {
            groupHasPlaced.set(piece.groupId, false);
          }
          if (piece.placed) {
            groupHasPlaced.set(piece.groupId, true);
          }
        });

        const mergeGroup = (sourceGroupId, targetGroupId, shiftX, shiftY) => {
          pieces.forEach((piece) => {
            if (piece.groupId === sourceGroupId) {
              piece.x += shiftX;
              piece.y += shiftY;
              piece.groupId = targetGroupId;
            }
          });
        };

        // Try to connect moved group with neighboring pieces
        groupPieces.forEach((piece) => {
          directions.forEach((dir) => {
            const neighbor = byPos.get(`${piece.row + dir.dy}-${piece.col + dir.dx}`);
            if (!neighbor || neighbor.groupId === piece.groupId) {
              return;
            }
            const expectedX = piece.x + dir.dx * piece.size;
            const expectedY = piece.y + dir.dy * piece.size;
            if (
              Math.abs(neighbor.x - expectedX) <= snapDistance &&
              Math.abs(neighbor.y - expectedY) <= snapDistance
            ) {
              const neighborHasPlaced = groupHasPlaced.get(neighbor.groupId);
              const pieceHasPlaced = groupHasPlaced.get(piece.groupId);
              if (neighborHasPlaced && !pieceHasPlaced) {
                const shiftX = neighbor.x - expectedX;
                const shiftY = neighbor.y - expectedY;
                mergeGroup(piece.groupId, neighbor.groupId, shiftX, shiftY);
              } else {
                const shiftX = expectedX - neighbor.x;
                const shiftY = expectedY - neighbor.y;
                mergeGroup(neighbor.groupId, piece.groupId, shiftX, shiftY);
              }
            }
          });
        });

        return pieces;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!pieces.length) {
      return;
    }
    const placedCount = pieces.filter((piece) => piece.placed).length;
    if (placedCount === pieces.length && !completionRef.current) {
      setIsComplete(true);
      setSuccessMessage("퍼즐 완성!");
      completionRef.current = true;
      allowRebuildRef.current = false;
      onComplete?.();
    } else if (placedCount !== pieces.length) {
      setIsComplete(false);
      setSuccessMessage("");
    }
  }, [pieces, onComplete]);

  useEffect(() => {
    allowRebuildRef.current = true;
    completionRef.current = false;
  }, [entry, size]);

  const handlePointerDown = useCallback((piece, event) => {
    if (piece.placed) {
      return;
    }
    if (pieces.some((item) => item.groupId === piece.groupId && item.placed)) {
      return;
    }
    event.preventDefault();
    const cardRect = layoutRef.current?.card;
    if (!cardRect) {
      return;
    }
    const pointerX = event.clientX - cardRect.left;
    const pointerY = event.clientY - cardRect.top;
    dragRef.current = {
      id: piece.id,
      groupId: piece.groupId,
      offsetX: pointerX - piece.x,
      offsetY: pointerY - piece.y,
    };
    setDraggingId(piece.id);
    setPieces((prev) =>
      prev.map((item) =>
        item.id === piece.id ? { ...item, z: zIndexRef.current + 1 } : item,
      ),
    );
    zIndexRef.current += 1;
  }, [pieces]);

  const handleReshuffle = useCallback(() => {
    allowRebuildRef.current = true;
    completionRef.current = false;
    buildPuzzle();
  }, [buildPuzzle]);

  return (
    <div className="puzzle-card" ref={cardRef}>
      <div className="puzzle-card-header">
        <div>
          <p className="puzzle-eyebrow">Puzzle {boardIndex + 1}</p>
          <h3>{entry.name_ko || entry.name || entry.name_en}</h3>
        </div>
        <button type="button" className="ghost" onClick={handleReshuffle}>
          조각 섞기
        </button>
      </div>
      <div className="puzzle-layout" ref={fieldRef}>
        <div className="puzzle-board" ref={boardRef}>
          <div className="puzzle-board-guide" />
        </div>
        <p className="puzzle-tray-label">조각을 드래그해서 맞춰보세요.</p>
      </div>

      {successMessage && <p className="puzzle-success">{successMessage}</p>}

      <div className="puzzle-piece-layer" aria-hidden="true">
        {pieces.map((piece) => (
          <canvas
            key={piece.id}
            ref={(node) => {
              if (node) {
                canvasRefs.current.set(piece.id, node);
              } else {
                canvasRefs.current.delete(piece.id);
              }
            }}
            className={`puzzle-piece${piece.placed ? " placed" : ""}${
              draggingId === piece.id ? " dragging" : ""
            }`}
            style={{
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              transform: `translate(${piece.x}px, ${piece.y}px)`,
              zIndex: piece.z,
            }}
            onPointerDown={(event) => handlePointerDown(piece, event)}
          />
        ))}
      </div>
      {isComplete && <div className="puzzle-complete-banner">완성!</div>}
    </div>
  );
}

export default function PuzzleGame() {
  const [mapping, setMapping] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [gridSize, setGridSize] = useState(3);
  const [activeEntries, setActiveEntries] = useState([]);
  const [gameSeed, setGameSeed] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastSelectedIdRef = useRef(null);
  const puzzleAreaRef = useRef(null);
  const puzzleFocusRef = useRef(null);

  useEffect(() => {
    fetch(`${baseUrl}data/mapping.json`)
      .then((res) => res.json())
      .then((data) => setMapping(data))
      .catch(() => {
        console.error("이미지 목록을 불러오지 못했습니다.");
      });
  }, []);

  const toggleSelect = useCallback((index) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(index);
      if (exists) {
        return [];
      }
      return [index];
    });
  }, []);

  const startGame = useCallback(() => {
    if (selectedIds.length !== 1) {
      return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const entries = selectedIds.map((id) => mapping[id]).filter(Boolean);
    setActiveEntries(entries);
    setGameSeed((seed) => seed + 1);
    setCompletedCount(0);
    setElapsedMs(0);
    setIsTiming(true);
    startTimeRef.current = Date.now();
    setCompletionVisible(false);
    setToastVisible(false);
  }, [mapping, selectedIds]);

  const resetSelection = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setSelectedIds([]);
    setActiveEntries([]);
    setCompletedCount(0);
    setElapsedMs(0);
    setIsTiming(false);
    startTimeRef.current = null;
    setCompletionVisible(false);
  }, []);

  const handleBoardComplete = useCallback(() => {
    setCompletedCount((count) => Math.min(count + 1, 1));
  }, []);

  const isReady = selectedIds.length === 1;
  const allComplete = completedCount >= activeEntries.length && activeEntries.length > 0;

  useEffect(() => {
    if (!isReady) {
      lastSelectedIdRef.current = null;
      return;
    }
    const currentId = selectedIds[0];
    const shouldStart =
      lastSelectedIdRef.current !== currentId || activeEntries.length === 0;
    if (shouldStart) {
      lastSelectedIdRef.current = currentId;
      startGame();
    }
  }, [isReady, startGame, activeEntries.length, selectedIds]);

  useEffect(() => {
    if (activeEntries.length > 0 && puzzleFocusRef.current) {
      puzzleFocusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (activeEntries.length > 0 && puzzleAreaRef.current) {
      puzzleAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeEntries]);

  useEffect(() => {
    if (!isTiming) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) {
        return;
      }
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTiming]);

  useEffect(() => {
    if (allComplete) {
      setIsTiming(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const finalElapsed = startTimeRef.current
        ? Date.now() - startTimeRef.current
        : elapsedMs;
      startTimeRef.current = null;
      setElapsedMs(finalElapsed);
      setToastMessage(`퍼즐 완성! ${formatElapsed(finalElapsed)}`);
      setToastVisible(true);
      setCompletionVisible(true);
      return undefined;
    }
    return undefined;
  }, [allComplete, elapsedMs, resetSelection]);

  const handleShuffle = useCallback(() => {
    if (selectedIds.length !== 1) {
      return;
    }
    setCompletionVisible(false);
    setToastVisible(false);
    setCompletedCount(0);
    setGameSeed((seed) => seed + 1);
    setElapsedMs(0);
    setIsTiming(true);
    startTimeRef.current = Date.now();
  }, [selectedIds.length]);

  const handlePickAnother = useCallback(() => {
    setToastVisible(false);
    resetSelection();
    if (puzzleAreaRef.current) {
      puzzleAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resetSelection]);

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">TinyPing Jigsaw</p>
          <h1>티니핑 퍼즐 맞추기</h1>
          <p className="sub">
            이미지를 하나 골라 퍼즐을 맞춰보세요. 난이도는 3x3에서 7x7까지 선택할 수 있어요.
          </p>
        </div>
        <div className="hero-panel">
          <div className="puzzle-controls">
            <div className="difficulty-selector">
              <label>난이도</label>
              <div className="difficulty-buttons">
                {[3, 4, 5, 6, 7].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={gridSize === value ? "active" : ""}
                    onClick={() => setGridSize(value)}
                  >
                    {value} x {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-buttons">
              <button type="button" className="ghost" onClick={resetSelection}>
                선택 초기화
              </button>
            </div>
            <div className="puzzle-timer">
              <span className="label">경과 시간</span>
              <span className="value">{formatElapsed(elapsedMs)}</span>
            </div>
          </div>
          {allComplete && null}
        </div>
      </header>

      <section className="puzzle-section" ref={puzzleAreaRef}>
        <div className="image-palette">
          <h3>이미지 선택 (1개)</h3>
          <p className="palette-note">이미지를 선택하면 퍼즐이 바로 시작됩니다.</p>
          <div className="palette-grid">
            {mapping.map((entry, index) => {
              const selected = selectedIds.includes(index);
              return (
                <div
                  key={`${entry.file}-${index}`}
                  className={`palette-item selectable ${selected ? "selected" : ""}`}
                  onClick={() => toggleSelect(index)}
                  title={entry.name_ko || entry.name || entry.name_en || "티니핑"}
                >
                  <img src={resolveAssetPath(entry.file)} alt={entry.name_ko || entry.name} />
                  {selected && <span className="palette-check">선택됨</span>}
                </div>
              );
            })}
          </div>
        </div>

        {activeEntries.length === 0 ? (
          <div className="puzzle-placeholder">
            <p>이미지를 1개 선택해 주세요.</p>
          </div>
        ) : (
          <div className="puzzle-grid" ref={puzzleFocusRef}>
            {activeEntries.map((entry, index) => (
              <PuzzleBoard
                key={`${entry.file}-${gameSeed}-${gridSize}-${index}`}
                entry={entry}
                size={gridSize}
                boardIndex={index}
                onComplete={handleBoardComplete}
              />
            ))}
          </div>
        )}
      </section>

      <div
        className={`toast${toastVisible ? " show" : ""}${
          completionVisible ? " toast-actions" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        <span>{toastMessage}</span>
        {completionVisible && (
          <div className="toast-buttons">
            <button type="button" onClick={handleShuffle}>
              다시 섞기
            </button>
            <button type="button" className="ghost" onClick={handlePickAnother}>
              다른 이미지 선택
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

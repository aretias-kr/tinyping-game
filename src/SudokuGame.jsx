import { useCallback, useEffect, useState } from "react";
import { generateSudoku, validateBoard, isBoardComplete, SUDOKU_SIZES, findHint } from "./sudokuUtils";

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

const DIFFICULTY_LABELS = {
  easy: "초급",
  medium: "중급",
  hard: "고급",
};

export default function SudokuGame() {
  const [mapping, setMapping] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [puzzle, setPuzzle] = useState(null);
  const [solution, setSolution] = useState(null);
  const [board, setBoard] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [difficulty, setDifficulty] = useState("easy");
  const [sizeType, setSizeType] = useState("large");
  const [sizeConfig, setSizeConfig] = useState(SUDOKU_SIZES.large);
  const [imageUsage, setImageUsage] = useState({});
  const [errors, setErrors] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [initialBoard, setInitialBoard] = useState(null);
  const [hintCell, setHintCell] = useState(null);

  // 이미지 매핑 로드
  useEffect(() => {
    fetch(`${baseUrl}data/mapping.json`)
      .then((res) => res.json())
      .then((data) => {
        setMapping(data);
      })
      .catch(() => {
        console.error("데이터를 불러오지 못했어요.");
      });
  }, []);

  // 게임 초기화
  const initializeGame = useCallback(() => {
    const currentSizeConfig = SUDOKU_SIZES[sizeType];
    const imageCount = currentSizeConfig.images;

    if (mapping.length < imageCount) return;

    // 이미지 랜덤 선택
    const shuffled = shuffle([...mapping]);
    const images = shuffled.slice(0, imageCount).map((entry, index) => ({
      id: index,
      entry,
      path: resolveAssetPath(entry.file),
    }));
    setSelectedImages(images);
    setSizeConfig(currentSizeConfig);

    // 이미지 사용 횟수 초기화
    const usage = {};
    images.forEach((img) => {
      usage[img.id] = 0;
    });
    setImageUsage(usage);

    // 스도쿠 생성
    const result = generateSudoku(difficulty, sizeType);
    setPuzzle(result.puzzle);
    setSolution(result.solution);
    setSizeConfig(result.sizeConfig);

    // 보드 초기화 (퍼즐 복사)
    const newBoard = result.puzzle.map((row) => [...row]);
    setBoard(newBoard);
    setInitialBoard(newBoard.map((row) => [...row])); // 초기 상태 저장

    // 초기 보드에서 이미지 사용 횟수 계산
    const initialUsage = { ...usage };
    const { size } = result.sizeConfig;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const value = newBoard[row][col];
        if (value !== null) {
          initialUsage[value] = (initialUsage[value] || 0) + 1;
        }
      }
    }
    setImageUsage(initialUsage);

    setSelectedCell(null);
    setErrors([]);
    setIsComplete(false);
    setHintCount(0); // 힌트 카운트 리셋
    setHintCell(null); // 힌트 셀 초기화
  }, [mapping, difficulty, sizeType]);

  // 이미지 로드 후 게임 초기화
  useEffect(() => {
    const currentSizeConfig = SUDOKU_SIZES[sizeType];
    if (mapping.length >= currentSizeConfig.images) {
      initializeGame();
    }
  }, [mapping, initializeGame]);

  // 난이도 또는 크기 변경 시 게임 재시작
  useEffect(() => {
    const currentSizeConfig = SUDOKU_SIZES[sizeType];
    if (mapping.length >= currentSizeConfig.images) {
      initializeGame();
    }
  }, [difficulty, sizeType, mapping.length, initializeGame]);

  // 보드 검증
  useEffect(() => {
    if (!board || !sizeConfig) return;

    const boardErrors = validateBoard(board, sizeConfig);
    setErrors(boardErrors);

    if (isBoardComplete(board, sizeConfig)) {
      setIsComplete(true);
      showToast("축하합니다! 스도쿠를 완성했습니다!");
    }
  }, [board, sizeConfig]);

  const showToast = useCallback((message, duration = 2000) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, duration);
  }, []);

  // 셀 클릭 핸들러
  const handleCellClick = useCallback((row, col) => {
    // 초기 값은 변경 불가
    if (puzzle && puzzle[row][col] !== null) {
      return;
    }
    setSelectedCell({ row, col });
  }, [puzzle]);

  // 이미지 팔레트 클릭 핸들러
  const handleImageClick = useCallback(
    (imageId) => {
      if (!selectedCell) return;

      const { row, col } = selectedCell;
      const maxUsage = sizeConfig.images;

      // 이미지가 최대 사용 횟수에 도달했는지 확인
      if (imageUsage[imageId] >= maxUsage) {
        showToast(`이 이미지는 이미 ${maxUsage}번 사용되었습니다!`);
        return;
      }

      // 보드 업데이트
      const newBoard = board.map((r) => [...r]);
      const oldValue = newBoard[row][col];

      // 이전 값 제거
      if (oldValue !== null) {
        setImageUsage((prev) => ({
          ...prev,
          [oldValue]: Math.max(0, (prev[oldValue] || 0) - 1),
        }));
      }

      // 새 값 설정
      newBoard[row][col] = imageId;
      setBoard(newBoard);

      // 이미지 사용 횟수 업데이트
      setImageUsage((prev) => ({
        ...prev,
        [imageId]: (prev[imageId] || 0) + 1,
      }));

      setSelectedCell(null);
    },
    [selectedCell, board, imageUsage, sizeConfig, showToast],
  );

  // 셀 지우기 (빈 셀 클릭 시)
  const handleCellClear = useCallback(
    (row, col, e) => {
      e.stopPropagation();
      if (puzzle && puzzle[row][col] !== null) return; // 초기 값은 지울 수 없음

      const newBoard = board.map((r) => [...r]);
      const oldValue = newBoard[row][col];

      if (oldValue !== null) {
        newBoard[row][col] = null;
        setBoard(newBoard);

        // 이미지 사용 횟수 감소
        setImageUsage((prev) => ({
          ...prev,
          [oldValue]: Math.max(0, (prev[oldValue] || 0) - 1),
        }));

        // 선택된 셀이면 선택 해제
        if (selectedCell?.row === row && selectedCell?.col === col) {
          setSelectedCell(null);
        }
      }
    },
    [board, puzzle, selectedCell],
  );

  // 셀이 에러인지 확인
  const isCellError = useCallback(
    (row, col) => {
      return errors.some((err) => err.row === row && err.col === col);
    },
    [errors],
  );

  // 이미지가 딤드되어야 하는지 확인
  const isImageDimmed = useCallback(
    (imageId) => {
      const maxUsage = sizeConfig.images;
      return (imageUsage[imageId] || 0) >= maxUsage;
    },
    [imageUsage, sizeConfig],
  );

  // 리셋 핸들러
  const handleReset = useCallback(() => {
    if (!initialBoard || !puzzle) return;

    // 초기 보드로 복원
    const resetBoard = initialBoard.map((row) => [...row]);
    setBoard(resetBoard);

    // 이미지 사용 횟수 초기화
    const resetUsage = {};
    selectedImages.forEach((img) => {
      resetUsage[img.id] = 0;
    });

    const { size } = sizeConfig;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const value = resetBoard[row][col];
        if (value !== null) {
          resetUsage[value] = (resetUsage[value] || 0) + 1;
        }
      }
    }
    setImageUsage(resetUsage);

    setSelectedCell(null);
    setErrors([]);
    setIsComplete(false);
    setHintCount(0);
    setHintCell(null);
    showToast("보드가 초기 상태로 리셋되었습니다.");
  }, [initialBoard, puzzle, selectedImages, sizeConfig, showToast]);

  // 힌트 핸들러
  const handleHint = useCallback(() => {
    if (!board || !sizeConfig) return;

    const hint = findHint(board, sizeConfig);

    if (!hint) {
      showToast("현재 해결 가능한 힌트를 찾을 수 없습니다. 다른 방법을 시도해보세요.");
      return;
    }

    const { row, col, reason } = hint;

    // 힌트 카운트 증가
    setHintCount((prev) => prev + 1);

    // 힌트 셀 하이라이트 (어느 칸을 봐야 하는지 안내)
    setHintCell({ row, col });
    setTimeout(() => {
      setHintCell(null);
    }, 3000); // 3초 후 하이라이트 제거

    // 힌트 설명 표시 (규칙 기반 메시지만 제공, 값은 직접 찾도록 유도)
    showToast(`힌트: (${row + 1}행, ${col + 1}열) - ${reason}`, 4000);
  }, [board, sizeConfig, showToast]);

  if (!board || selectedImages.length === 0) {
    return (
      <main className="page">
        <div className="loading">게임을 준비하고 있습니다...</div>
      </main>
    );
  }

  const { size, boxRows, boxCols, images: imageCount } = sizeConfig;

  return (
    <>
      <main className="page">
        <header className="hero">
          <div className="hero-text">
            <p className="eyebrow">TinyPing Sudoku</p>
            <h1>티니핑 스도쿠</h1>
            <p className="sub">
              이미지로 스도쿠를 풀어보세요. 각 이미지는 정확히 {imageCount}번 사용됩니다.
            </p>
          </div>
          <div className="hero-panel">
            <div className="sudoku-controls">
              <div className="size-selector">
                <label>크기:</label>
                <div className="size-buttons">
                  {Object.entries(SUDOKU_SIZES).map(([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      className={sizeType === key ? "active" : ""}
                      onClick={() => setSizeType(key)}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="difficulty-selector">
                <label>난이도:</label>
                <div className="difficulty-buttons">
                  {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={difficulty === key ? "active" : ""}
                      onClick={() => setDifficulty(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-buttons">
                <button type="button" className="ghost" onClick={initializeGame}>
                  새 게임
                </button>
                <button type="button" className="ghost" onClick={handleReset}>
                  리셋
                </button>
                <button type="button" className="ghost hint-button" onClick={handleHint}>
                  힌트
                </button>
                <button type="button" className="ghost" onClick={() => setShowRules(true)}>
                  규칙 보기
                </button>
              </div>
              {hintCount > 0 && (
                <div className="hint-counter">
                  힌트 사용: {hintCount}회
                </div>
              )}
            </div>
            {isComplete && (
              <div className="completion-message">
                <p>🎉 축하합니다! 스도쿠를 완성했습니다!</p>
              </div>
            )}
          </div>
        </header>

        <section className="sudoku-section">
          {/* 이미지 팔레트 */}
          <div className="image-palette">
            <h3>이미지 선택</h3>
            <div className="palette-grid">
              {selectedImages.map((img) => {
                const dimmed = isImageDimmed(img.id);
                const usageCount = imageUsage[img.id] || 0;
                return (
                  <div
                    key={img.id}
                    className={`palette-item ${dimmed ? "dimmed" : ""} ${
                      selectedCell ? "selectable" : ""
                    }`}
                    onClick={() => !dimmed && selectedCell && handleImageClick(img.id)}
                    title={dimmed ? `이미 ${imageCount}번 사용됨` : `${usageCount}/${imageCount} 사용됨`}
                  >
                    <img src={img.path} alt={img.entry.name_ko || img.entry.name} />
                    <div className="usage-badge">{usageCount}/{imageCount}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 스도쿠 그리드 */}
          <div className="sudoku-container">
            <div className={`sudoku-grid sudoku-grid-${size}`}>
              {board.map((row, rowIndex) =>
                row.map((cellValue, colIndex) => {
                  const isInitial = puzzle[rowIndex][colIndex] !== null;
                  const isSelected =
                    selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  const hasError = isCellError(rowIndex, colIndex);
                  const isHintCell =
                    hintCell?.row === rowIndex && hintCell?.col === colIndex;
                  const boxRow = Math.floor(rowIndex / boxRows);
                  const boxCol = Math.floor(colIndex / boxCols);
                  const isBoxBorderRight = colIndex % boxCols === boxCols - 1 && colIndex < size - 1;
                  const isBoxBorderBottom = rowIndex % boxRows === boxRows - 1 && rowIndex < size - 1;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`sudoku-cell ${isInitial ? "initial" : ""} ${
                        isSelected ? "selected" : ""
                      } ${hasError ? "error" : ""} ${isHintCell ? "hint" : ""}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onDoubleClick={(e) => handleCellClear(rowIndex, colIndex, e)}
                      style={{
                        borderRight: isBoxBorderRight ? "3px solid var(--ink)" : "1px solid rgba(28, 26, 26, 0.2)",
                        borderBottom: isBoxBorderBottom ? "3px solid var(--ink)" : "1px solid rgba(28, 26, 26, 0.2)",
                      }}
                    >
                      {cellValue !== null ? (
                        <img
                          src={selectedImages[cellValue].path}
                          alt={selectedImages[cellValue].entry.name_ko || selectedImages[cellValue].entry.name}
                        />
                      ) : (
                        <div className="cell-empty" />
                      )}
                    </div>
                  );
                }),
              )}
            </div>
            <p className="sudoku-hint">
              셀을 클릭한 후 이미지를 선택하세요. 더블클릭으로 지울 수 있습니다.
            </p>
          </div>
        </section>
      </main>

      {/* 규칙 모달 */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>스도쿠 규칙</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowRules(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="rules-section">
                <h3>기본 규칙</h3>
                <ul>
                  <li>
                    <strong>행 규칙:</strong> 각 행에는 모든 이미지가 정확히 한 번씩만 나타나야 합니다.
                  </li>
                  <li>
                    <strong>열 규칙:</strong> 각 열에는 모든 이미지가 정확히 한 번씩만 나타나야 합니다.
                  </li>
                  <li>
                    <strong>박스 규칙:</strong> 각 박스(작은 사각형 영역)에는 모든 이미지가 정확히 한 번씩만 나타나야 합니다.
                  </li>
                  <li>
                    <strong>이미지 사용:</strong> 각 이미지는 전체 보드에서 정확히 {imageCount}번 사용됩니다.
                  </li>
                </ul>
              </div>
              <div className="rules-section">
                <h3>게임 방법</h3>
                <ul>
                  <li>빈 셀을 클릭하여 선택합니다.</li>
                  <li>상단의 이미지 팔레트에서 이미지를 클릭하여 선택한 셀에 입력합니다.</li>
                  <li>이미지가 {imageCount}번 사용되면 더 이상 사용할 수 없습니다 (딤드 처리).</li>
                  <li>셀을 더블클릭하면 입력한 값을 지울 수 있습니다.</li>
                  <li>잘못된 입력은 빨간색으로 표시됩니다.</li>
                  <li>힌트 버튼은 자동으로 답을 채워 주지 않고, 어떤 칸을 어떤 규칙으로 보면 되는지를 설명만 제공합니다.</li>
                  <li>힌트 설명을 읽고 스스로 이미지를 선택해 넣어 보세요. 힌트는 4x4, 6x6, 9x9 모든 크기에서 사용할 수 있습니다.</li>
                  <li>모든 셀을 올바르게 채우면 게임이 완료됩니다!</li>
                </ul>
              </div>
              <div className="rules-section">
                <h3>크기별 박스 구성</h3>
                <ul>
                  <li><strong>4x4:</strong> 2x2 박스 4개</li>
                  <li><strong>6x6:</strong> 2x3 박스 6개</li>
                  <li><strong>9x9:</strong> 3x3 박스 9개</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowRules(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

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

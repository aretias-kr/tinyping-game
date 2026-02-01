// 스도쿠 유틸리티 함수들

// 스도쿠 크기 설정
export const SUDOKU_SIZES = {
  small: { size: 4, boxRows: 2, boxCols: 2, images: 4, label: "4x4 (초심자)" },
  medium: { size: 6, boxRows: 2, boxCols: 3, images: 6, label: "6x6 (중급자)" },
  large: { size: 9, boxRows: 3, boxCols: 3, images: 9, label: "9x9 (고급자)" },
};

// 난이도별 초기 값 개수 (크기별)
export const DIFFICULTY_GIVENS = {
  easy: { small: 8, medium: 18, large: 40 }, // 초급
  medium: { small: 6, medium: 14, large: 30 }, // 중급
  hard: { small: 4, medium: 10, large: 20 }, // 고급
};

// 빈 보드 생성
function createEmptyBoard(size) {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
}

// 숫자가 유효한지 검증 (행, 열, 박스)
function isValid(board, row, col, num, size, boxRows, boxCols) {
  // 행 검증
  for (let c = 0; c < size; c++) {
    if (board[row][c] === num) return false;
  }

  // 열 검증
  for (let r = 0; r < size; r++) {
    if (board[r][col] === num) return false;
  }

  // 박스 검증
  const boxRow = Math.floor(row / boxRows) * boxRows;
  const boxCol = Math.floor(col / boxCols) * boxCols;
  for (let r = boxRow; r < boxRow + boxRows; r++) {
    for (let c = boxCol; c < boxCol + boxCols; c++) {
      if (board[r][c] === num) return false;
    }
  }

  return true;
}

// 백트래킹으로 완전한 스도쿠 생성
function solveSudoku(board, size, boxRows, boxCols) {
  const numbers = Array.from({ length: size }, (_, i) => i);
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === null) {
        // 셔플하여 랜덤한 순서로 시도
        const shuffled = [...numbers];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (const num of shuffled) {
          if (isValid(board, row, col, num, size, boxRows, boxCols)) {
            board[row][col] = num;
            if (solveSudoku(board, size, boxRows, boxCols)) {
              return true;
            }
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// 완전한 스도쿠 보드 생성
function generateCompleteBoard(size, boxRows, boxCols) {
  const board = createEmptyBoard(size);
  solveSudoku(board, size, boxRows, boxCols);
  return board;
}

// 셀을 제거해도 유일한 해가 있는지 검증
function hasUniqueSolution(board, size, boxRows, boxCols) {
  const tempBoard = board.map((row) => [...row]);
  let solutionCount = 0;

  function countSolutions(b) {
    if (solutionCount > 1) return; // 2개 이상이면 중단

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (b[row][col] === null) {
          for (let num = 0; num < size; num++) {
            if (isValid(b, row, col, num, size, boxRows, boxCols)) {
              b[row][col] = num;
              countSolutions(b);
              b[row][col] = null;
              if (solutionCount > 1) return;
            }
          }
          return;
        }
      }
    }
    solutionCount++;
  }

  countSolutions(tempBoard);
  return solutionCount === 1;
}

// 난이도에 따라 퍼즐 생성
export function generateSudoku(difficulty = "easy", sizeType = "large") {
  const sizeConfig = SUDOKU_SIZES[sizeType];
  if (!sizeConfig) {
    throw new Error(`Invalid size type: ${sizeType}`);
  }

  const { size, boxRows, boxCols } = sizeConfig;
  const givens = DIFFICULTY_GIVENS[difficulty][sizeType] || DIFFICULTY_GIVENS.easy[sizeType];

  // 완전한 보드 생성
  const completeBoard = generateCompleteBoard(size, boxRows, boxCols);

  // 퍼즐 보드 복사
  const puzzle = completeBoard.map((row) => [...row]);

  // 셀 위치를 랜덤하게 섞기
  const cells = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      cells.push({ row, col });
    }
  }

  // 셔플
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  // 셀 제거 시도
  let removed = 0;
  const targetRemoved = size * size - givens;

  for (const cell of cells) {
    if (removed >= targetRemoved) break;

    const originalValue = puzzle[cell.row][cell.col];
    puzzle[cell.row][cell.col] = null;

    // 유일한 해가 있는지 확인
    if (hasUniqueSolution(puzzle, size, boxRows, boxCols)) {
      removed++;
    } else {
      // 유일한 해가 없으면 원래 값 복원
      puzzle[cell.row][cell.col] = originalValue;
    }
  }

  return {
    puzzle, // 퍼즐 (일부 셀이 null)
    solution: completeBoard, // 완전한 해
    sizeConfig, // 크기 설정 정보
  };
}

// 보드 검증 (사용자 입력이 올바른지)
export function validateBoard(board, sizeConfig) {
  const errors = [];
  const { size, boxRows, boxCols } = sizeConfig;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = board[row][col];
      if (value === null) continue;

      // 행 검증
      for (let c = 0; c < size; c++) {
        if (c !== col && board[row][c] === value) {
          errors.push({ row, col, type: "row" });
        }
      }

      // 열 검증
      for (let r = 0; r < size; r++) {
        if (r !== row && board[r][col] === value) {
          errors.push({ row, col, type: "col" });
        }
      }

      // 박스 검증
      const boxRow = Math.floor(row / boxRows) * boxRows;
      const boxCol = Math.floor(col / boxCols) * boxCols;
      for (let r = boxRow; r < boxRow + boxRows; r++) {
        for (let c = boxCol; c < boxCol + boxCols; c++) {
          if (r !== row && c !== col && board[r][c] === value) {
            errors.push({ row, col, type: "box" });
          }
        }
      }
    }
  }

  return errors;
}

// 보드가 완성되었는지 확인
export function isBoardComplete(board, sizeConfig) {
  const { size } = sizeConfig;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === null) return false;
    }
  }
  return validateBoard(board, sizeConfig).length === 0;
}

// 박스 인덱스 계산
export function getBoxIndex(row, col, boxRows, boxCols) {
  return Math.floor(row / boxRows) * boxCols + Math.floor(col / boxCols);
}

// 셀에 가능한 값들 찾기
function getPossibleValues(board, row, col, sizeConfig) {
  const { size, boxRows, boxCols } = sizeConfig;
  const possible = [];
  
  for (let num = 0; num < size; num++) {
    if (isValid(board, row, col, num, size, boxRows, boxCols)) {
      possible.push(num);
    }
  }
  
  return possible;
}

// 힌트 찾기 (가능한 값이 하나뿐인 셀 찾기)
export function findHint(board, sizeConfig) {
  const { size } = sizeConfig;
  
  // 모든 빈 셀을 확인
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === null) {
        const possible = getPossibleValues(board, row, col, sizeConfig);
        
        // 가능한 값이 하나뿐이면 힌트로 제공
        if (possible.length === 1) {
          const value = possible[0];
          const reason = getHintReason(board, row, col, value, sizeConfig);
          return {
            row,
            col,
            value,
            reason,
          };
        }
      }
    }
  }
  
  return null; // 힌트를 찾을 수 없음
}

// 힌트의 이유 설명 생성
function getHintReason(board, row, col, value, sizeConfig) {
  const { size, boxRows, boxCols } = sizeConfig;
  const reasons = [];
  
  // 행 분석: 해당 행에서 이 값이 들어갈 수 있는 위치가 하나뿐인지
  let rowPossibleCount = 0;
  for (let c = 0; c < size; c++) {
    if (board[row][c] === null && isValid(board, row, c, value, size, boxRows, boxCols)) {
      rowPossibleCount++;
    }
  }
  if (rowPossibleCount === 1) {
    reasons.push(`${row + 1}행`);
  }
  
  // 열 분석: 해당 열에서 이 값이 들어갈 수 있는 위치가 하나뿐인지
  let colPossibleCount = 0;
  for (let r = 0; r < size; r++) {
    if (board[r][col] === null && isValid(board, r, col, value, size, boxRows, boxCols)) {
      colPossibleCount++;
    }
  }
  if (colPossibleCount === 1) {
    reasons.push(`${col + 1}열`);
  }
  
  // 박스 분석: 해당 박스에서 이 값이 들어갈 수 있는 위치가 하나뿐인지
  const boxRow = Math.floor(row / boxRows) * boxRows;
  const boxCol = Math.floor(col / boxCols) * boxCols;
  let boxPossibleCount = 0;
  for (let r = boxRow; r < boxRow + boxRows; r++) {
    for (let c = boxCol; c < boxCol + boxCols; c++) {
      if (board[r][c] === null && isValid(board, r, c, value, size, boxRows, boxCols)) {
        boxPossibleCount++;
      }
    }
  }
  if (boxPossibleCount === 1) {
    reasons.push("박스");
  }
  
  // 이유가 없으면 기본 메시지 (단순히 가능한 값이 하나뿐)
  if (reasons.length === 0) {
    return "이 셀에 들어갈 수 있는 값이 하나뿐입니다";
  }
  
  // 여러 이유가 있으면 모두 나열
  if (reasons.length > 1) {
    return `${reasons.join(", ")} 규칙에 의해 이 위치에만 들어갈 수 있습니다`;
  }
  
  // 하나의 이유만 있으면 더 구체적으로 설명
  const reason = reasons[0];
  if (reason.includes("행")) {
    return `${reason}에서 이 값이 들어갈 수 있는 위치가 이곳뿐입니다`;
  } else if (reason.includes("열")) {
    return `${reason}에서 이 값이 들어갈 수 있는 위치가 이곳뿐입니다`;
  } else {
    return "박스 규칙에 의해 이 위치에만 들어갈 수 있습니다";
  }
}

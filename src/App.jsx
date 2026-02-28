import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import NameGame from "./NameGame.jsx";
import SudokuGame from "./SudokuGame.jsx";
import PuzzleGame from "./PuzzleGame.jsx";

export default function App() {
  return (
    <>
      <div className="game-menu">
        <NavLink to="/name" className={({ isActive }) => (isActive ? "active" : "")}
        >
          이름 맞추기
        </NavLink>
        <NavLink to="/sudoku" className={({ isActive }) => (isActive ? "active" : "")}
        >
          스도쿠
        </NavLink>
        <NavLink to="/puzzle" className={({ isActive }) => (isActive ? "active" : "")}
        >
          퍼즐 맞추기
        </NavLink>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="/name" replace />} />
        <Route path="/name" element={<NameGame />} />
        <Route path="/sudoku" element={<SudokuGame />} />
        <Route path="/puzzle" element={<PuzzleGame />} />
        <Route path="*" element={<Navigate to="/name" replace />} />
      </Routes>
    </>
  );
}

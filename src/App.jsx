import { useState } from "react";
import NameGame from "./NameGame.jsx";
import SudokuGame from "./SudokuGame.jsx";

export default function App() {
  const [currentGame, setCurrentGame] = useState("name"); // "name" or "sudoku"

  return (
    <>
      <div className="game-menu">
        <button
          type="button"
          className={currentGame === "name" ? "active" : ""}
          onClick={() => setCurrentGame("name")}
        >
          이름 맞추기
        </button>
        <button
          type="button"
          className={currentGame === "sudoku" ? "active" : ""}
          onClick={() => setCurrentGame("sudoku")}
        >
          스도쿠
        </button>
      </div>
      {currentGame === "name" ? <NameGame /> : <SudokuGame />}
    </>
  );
}

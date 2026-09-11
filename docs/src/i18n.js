const EN = {
  restart: "Restart", hp: "HP", wave: "WAVE", score: "SCORE", totalHp: "TOTAL HP",
  hint: "Build columns to evolve weapons", gameOver: "GAME OVER", boardStuck: "No more moves",
  hpZero: "Defense collapsed", finalScore: "Score", best: "Best", playAgain: "Play Again", bossWarning: "BOSS WARNING",
};
const JA = {
  restart: "リスタート", hp: "HP", wave: "WAVE", score: "SCORE", totalHp: "TOTAL HP",
  hint: "列を育てて武器進化", gameOver: "GAME OVER", boardStuck: "2048盤面が詰まりました",
  hpZero: "総HPが0になりました", finalScore: "スコア", best: "ベスト", playAgain: "もう一度", bossWarning: "BOSS WARNING",
};
export function strings(locale) { return String(locale).toLowerCase().startsWith("ja") ? JA : EN; }

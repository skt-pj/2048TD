const EN = {
  restart: "Restart", hp: "HP", wave: "WAVE", score: "SCORE", totalHp: "TOTAL HP",
  hint: "Build columns to evolve weapons", gameOver: "GAME OVER", boardStuck: "No more moves",
  hpZero: "Defense collapsed", finalScore: "Score", best: "Best", playAgain: "Play Again", bossWarning: "BOSS WARNING",
  settings: "Settings", closeSettings: "Close settings", settingsKicker: "GAME SETTINGS",
  landscapeLayout: "Landscape layout", landscapeDescription: "Choose which side keeps the 2048 board in landscape.",
  leftHand: "Left hand", leftHandDescription: "2048 on the left", rightHand: "Right hand", rightHandDescription: "2048 on the right",
  portraitUnchanged: "Portrait layout is unchanged.", done: "Done", restartGame: "Restart game",
};
const JA = {
  restart: "リスタート", hp: "HP", wave: "WAVE", score: "SCORE", totalHp: "TOTAL HP",
  hint: "列を育てて武器進化", gameOver: "GAME OVER", boardStuck: "2048盤面が詰まりました",
  hpZero: "総HPが0になりました", finalScore: "スコア", best: "ベスト", playAgain: "もう一度", bossWarning: "BOSS WARNING",
  settings: "設定", closeSettings: "設定を閉じる", settingsKicker: "GAME SETTINGS",
  landscapeLayout: "横画面レイアウト", landscapeDescription: "横画面で2048を操作する側を選べます。",
  leftHand: "左手モード", leftHandDescription: "2048を左側に配置", rightHand: "右手モード", rightHandDescription: "2048を右側に配置",
  portraitUnchanged: "縦画面のレイアウトには影響しません。", done: "完了", restartGame: "ゲームをリスタート",
};
export function strings(locale) { return String(locale).toLowerCase().startsWith("ja") ? JA : EN; }

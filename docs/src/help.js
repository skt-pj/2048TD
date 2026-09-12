const $ = (id) => document.getElementById(id);

const COPY = {
  en: {
    menuTitle: "Help",
    menuDescription: "Show controls on the game screen",
    title: "How to play",
    back: "Back to settings",
    steps: [
      "Swipe in 4 directions. Merge equal tiles.",
      "Weapons auto-attack from occupied columns.",
      "Merge tiles to charge FEVER. Full gauge activates it.",
    ],
  },
  ja: {
    menuTitle: "ヘルプ",
    menuDescription: "操作方法を画面で確認",
    title: "操作ガイド",
    back: "設定に戻る",
    steps: [
      "上下左右にスワイプ。同じ数字を合体",
      "数字がある列の武器が自動攻撃",
      "マージでFEVERゲージ。満タンで発動",
    ],
  },
};

const settingsOverlay = $("settings-overlay");
const settingsActions = document.querySelector(".settings-actions");
const app = $("app");

if (settingsOverlay && settingsActions && app) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./help.css?v=settings-help-1";
  document.head.append(stylesheet);

  const helpSection = document.createElement("div");
  helpSection.className = "settings-section settings-help-section";
  helpSection.innerHTML = `
    <button id="settings-help" class="settings-help-button" type="button" aria-haspopup="dialog" aria-controls="help-overlay">
      <span class="settings-help-icon" aria-hidden="true">?</span>
      <span class="settings-help-copy">
        <strong id="settings-help-title">Help</strong>
        <small id="settings-help-description">Show controls on the game screen</small>
      </span>
      <span class="settings-help-chevron" aria-hidden="true">›</span>
    </button>`;
  settingsActions.before(helpSection);

  const helpOverlay = document.createElement("div");
  helpOverlay.id = "help-overlay";
  helpOverlay.className = "help-overlay";
  helpOverlay.hidden = true;
  helpOverlay.setAttribute("role", "dialog");
  helpOverlay.setAttribute("aria-modal", "true");
  helpOverlay.setAttribute("aria-labelledby", "help-title");
  helpOverlay.innerHTML = `
    <div class="help-capture-dim" aria-hidden="true"></div>
    <header class="help-toolbar">
      <button id="help-back" class="help-back" type="button" aria-label="Back to settings">←</button>
      <div class="help-heading">
        <span>HOW TO PLAY</span>
        <strong id="help-title">How to play</strong>
      </div>
    </header>
    <div class="help-focus" data-help-focus="board" aria-hidden="true"><span>1</span></div>
    <div class="help-focus" data-help-focus="weapons" aria-hidden="true"><span>2</span></div>
    <div class="help-focus" data-help-focus="fever" aria-hidden="true"><span>3</span></div>
    <section class="help-guide-card" aria-label="Controls">
      <div class="help-step"><b>1</b><span id="help-step-1"></span></div>
      <div class="help-step"><b>2</b><span id="help-step-2"></span></div>
      <div class="help-step"><b>3</b><span id="help-step-3"></span></div>
    </section>`;
  app.append(helpOverlay);

  const focusTargets = [
    ["board", "#board", 6],
    ["weapons", "#weapon-strip", 4],
    ["fever", "#fever-meter", 4],
  ];

  function copyForCurrentLanguage() {
    return $("settings-title")?.textContent?.trim() === "設定" ? COPY.ja : COPY.en;
  }

  function applyCopy() {
    const copy = copyForCurrentLanguage();
    $("settings-help-title").textContent = copy.menuTitle;
    $("settings-help-description").textContent = copy.menuDescription;
    $("help-title").textContent = copy.title;
    $("help-back").setAttribute("aria-label", copy.back);
    copy.steps.forEach((step, index) => {
      $(`help-step-${index + 1}`).textContent = step;
    });
  }

  function layoutFocuses() {
    if (helpOverlay.hidden) return;
    const overlayRect = helpOverlay.getBoundingClientRect();
    for (const [name, selector, padding] of focusTargets) {
      const target = document.querySelector(selector);
      const focus = helpOverlay.querySelector(`[data-help-focus="${name}"]`);
      if (!target || !focus) continue;
      const rect = target.getBoundingClientRect();
      focus.style.left = `${rect.left - overlayRect.left - padding}px`;
      focus.style.top = `${rect.top - overlayRect.top - padding}px`;
      focus.style.width = `${rect.width + padding * 2}px`;
      focus.style.height = `${rect.height + padding * 2}px`;
    }
  }

  function openHelp() {
    applyCopy();
    settingsOverlay.hidden = true;
    helpOverlay.hidden = false;
    requestAnimationFrame(() => {
      layoutFocuses();
      $("help-back").focus({ preventScroll: true });
    });
  }

  function closeHelp() {
    if (helpOverlay.hidden) return;
    helpOverlay.hidden = true;
    settingsOverlay.hidden = false;
    $("settings-help").focus({ preventScroll: true });
  }

  $("settings-help").addEventListener("click", openHelp);
  $("help-back").addEventListener("click", closeHelp);
  globalThis.addEventListener("resize", layoutFocuses, { passive: true });
  globalThis.addEventListener("orientationchange", () => setTimeout(layoutFocuses, 60), { passive: true });
  document.addEventListener("keydown", (event) => {
    if (helpOverlay.hidden || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeHelp();
  }, true);

  const settingsTitle = $("settings-title");
  if (settingsTitle) new MutationObserver(applyCopy).observe(settingsTitle, { childList: true, subtree: true });
  applyCopy();
}

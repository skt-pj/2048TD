const styleLink = document.createElement("link");
styleLink.rel = "stylesheet";
styleLink.href = new URL("../board-styles.css?v=board-style-2", import.meta.url).href;
document.head.appendChild(styleLink);

const firstAudioSection = document.querySelector(".settings-audio-section");
if (firstAudioSection && !document.getElementById("board-style-options")) {
  const section = document.createElement("div");
  section.className = "settings-section board-style-settings";
  section.innerHTML = `
    <div class="settings-section-title-row">
      <div>
        <h3 id="board-style-title">2048 style</h3>
        <p id="board-style-description">Change the look of the 2048 puzzle only.</p>
      </div>
    </div>
    <div id="board-style-options" class="board-style-options" role="radiogroup" aria-labelledby="board-style-title">
      <button id="board-style-classic" class="board-style-option" type="button" role="radio" aria-checked="true" data-board-style="classic">
        <span class="board-style-preview preview-classic" aria-hidden="true"><i>2</i><i>4</i><i>8</i><i>16</i></span>
        <strong id="board-style-classic-label">Classic</strong>
        <span class="selection-dot" aria-hidden="true"></span>
      </button>
      <button id="board-style-modern" class="board-style-option" type="button" role="radio" aria-checked="false" data-board-style="modern">
        <span class="board-style-preview preview-modern" aria-hidden="true"><i>2</i><i>4</i><i>8</i><i>16</i></span>
        <strong id="board-style-modern-label">Modern</strong>
        <span class="selection-dot" aria-hidden="true"></span>
      </button>
      <button id="board-style-sf" class="board-style-option" type="button" role="radio" aria-checked="false" data-board-style="sf">
        <span class="board-style-preview preview-sf" aria-hidden="true"><i>2</i><i>4</i><i>8</i><i>16</i></span>
        <strong id="board-style-sf-label">SF</strong>
        <span class="selection-dot" aria-hidden="true"></span>
      </button>
    </div>`;
  firstAudioSection.before(section);
}

// 表示の設定と呼吸の体験だけ。通信・計測は行わない。
const root = document.documentElement;
const japanese = root.lang === "ja";
const themeButton = document.querySelector("[data-theme-toggle]");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
function updateTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#fafbfc" : "#050506");
  if (themeButton) {
    themeButton.hidden = false;
    themeButton.setAttribute("aria-label", theme === "light"
      ? (japanese ? "墨の外観にする" : "Use the ink theme")
      : (japanese ? "白の外観にする" : "Use the light theme"));
  }
}
try { updateTheme(localStorage.getItem("zennoma.site.theme") === "light" ? "light" : "dark"); }
catch { updateTheme("dark"); }
themeButton?.addEventListener("click", () => {
  const theme = root.dataset.theme === "light" ? "dark" : "light";
  updateTheme(theme);
  try { localStorage.setItem("zennoma.site.theme", theme); } catch { /* 保存できなくても切り替える */ }
});
// 動きを減らす設定やJSを使えない環境では、最初から全文を見せる。
if ("IntersectionObserver" in window && !motion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: .08 });
  root.classList.add("has-observer");
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}
const toggle = document.querySelector("[data-breath-toggle]");
const toggleLabel = document.querySelector("[data-breath-toggle-label]");
const initial = document.querySelector("[data-breath-initial]");
const guide = document.querySelector("[data-breath-guide]");
const phaseText = document.querySelector("[data-breath-phase]");
const progress = document.querySelector("[data-breath-progress]");
const ring = document.querySelector(".enso-stage");
let startedAt = 0;
let timer;
let active = false;
let lastPhase = "";
if (toggle) toggle.hidden = false;
function stopBreathing(finished = false) {
  active = false;
  clearInterval(timer);
  toggle?.setAttribute("aria-pressed", "false");
  ring?.querySelectorAll("img").forEach((image) => { image.style.transform = ""; });
  initial.hidden = finished;
  guide.hidden = !finished;
  if (finished) {
    phaseText.textContent = japanese ? "ひと息。" : "A fresh start.";
    progress.textContent = japanese ? "この続きは、あなたの時間へ。" : "The next moment is yours.";
  }
  toggleLabel.textContent = finished
    ? (japanese ? "もう一度、呼吸する" : "Breathe again")
    : (japanese ? "90秒の呼吸を体験する" : "Try 90 seconds of breathing");
}
function tick() {
  const elapsed = (performance.now() - startedAt) / 1000;
  if (elapsed >= 90) { stopBreathing(true); return; }
  const cycle = Math.floor(elapsed / 15);
  const position = elapsed % 15;
  // 元データ shared/breathing.json と同じ、吸5・切替1・吐8・切替1を6回。
  const phase = position < 6 ? "inhale" : "exhale";
  if (phase !== lastPhase) {
    phaseText.textContent = phase === "inhale" ? (japanese ? "吸う" : "Breathe in") : (japanese ? "吐く" : "Breathe out");
    lastPhase = phase;
  }
  const count = (cycle + 1) + (japanese ? " / 6 呼吸" : " / 6 breaths");
  if (progress.textContent !== count) progress.textContent = count;
  if (!motion.matches) {
    const scale = position < 5 ? .94 + .12 * position / 5
      : position < 6 ? 1.06 : position < 14 ? 1.06 - .12 * (position - 6) / 8 : .94;
    ring.querySelectorAll("img").forEach((image) => { image.style.transform = "scale(" + scale + ")"; });
  }
}
toggle?.addEventListener("click", () => {
  if (active) { stopBreathing(); return; }
  active = true;
  lastPhase = "";
  startedAt = performance.now();
  initial.hidden = true;
  guide.hidden = false;
  toggle.setAttribute("aria-pressed", "true");
  toggleLabel.textContent = japanese ? "体験を終える" : "End the breathing preview";
  tick();
  timer = setInterval(tick, 100);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && active) stopBreathing(); });

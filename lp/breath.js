// LP で90秒の呼吸を体験する — アプリの集中前の呼吸（shared/breathing.json の settle）と同じ。
// 吸5・切り替え1・吐8・切り替え1 を6回。吸うと筆が円相を描き、吐くと線が薄れて縁から波紋が広がる。
// 数字の残り時間は出さない。吸う／吐くと、何呼吸目か（積み上げ）だけを出す（docs/呼吸.md）。
// 文言は HTML の data-* に置く（言語ごとのページが持つ）— ここには文言を書かない。
import { loadTrail, fitCanvas, paintEnso, inhaleDraw, easeInOut, easeOut } from "./enso.js";

const CYCLE = { inhale: 5, holdIn: 1, exhale: 8, holdOut: 1 };
const REPEAT = 6;
const PERIOD = CYCLE.inhale + CYCLE.holdIn + CYCLE.exhale + CYCLE.holdOut;
const TOTAL = PERIOD * REPEAT;
/** 波紋が消えるときの半径 ÷ 円相の直径（アプリの 320 / 264） */
const RIPPLE_REACH = 320 / 264;
const RIPPLE_DELAYS = [0, 0.14];

const root = document.querySelector("[data-breath]");
if (root) setUp(root);

function setUp(root) {
  const canvas = root.querySelector("[data-breath-enso]");
  const stage = root.querySelector(".breath-stage");
  const ripples = [...root.querySelectorAll(".breath-ripple")];
  const phaseText = root.querySelector("[data-breath-phase]");
  const countText = root.querySelector("[data-breath-count]");
  const done = root.querySelector("[data-breath-done]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const bell = new Audio("/assets/bell.m4a");
  bell.volume = 0.45;
  let opener = null, raf = 0, startedAt = 0, hiddenAt = 0, lastProgress = -1, lastPhase = "";

  const ring = () => { try { bell.currentTime = 0; bell.play().catch(() => {}); } catch { /* 鳴らせなくても続ける */ } };

  /** いまの局面と、その中の進み（0..1） */
  function stateAt(sec) {
    const pos = sec % PERIOD;
    if (pos < CYCLE.inhale) return { phase: "inhale", p: pos / CYCLE.inhale };
    if (pos < CYCLE.inhale + CYCLE.holdIn) return { phase: "holdIn", p: 1 };
    const ex = pos - CYCLE.inhale - CYCLE.holdIn;
    if (ex < CYCLE.exhale) return { phase: "exhale", p: ex / CYCLE.exhale };
    return { phase: "holdOut", p: 1 };
  }

  function render(sec) {
    const { phase, p } = stateAt(sec);
    const full = phase === "inhale" ? easeInOut(p) : phase === "holdIn" ? 1 : phase === "exhale" ? 1 - easeOut(p) : 0;
    const reduced = motion.matches;
    const progress = reduced ? 1 : phase === "inhale" ? inhaleDraw(p) : phase === "holdOut" ? 0 : 1;
    const ink = reduced ? 0.35 + 0.55 * full : phase === "exhale" ? 1 - easeOut(p) : phase === "holdOut" ? 0 : 1;
    if (progress !== lastProgress) { paintEnso(canvas, progress); lastProgress = progress; }
    canvas.style.opacity = ink;
    canvas.style.transform = reduced ? "" : `scale(${0.94 + 0.12 * full})`;
    // 吐く息の波紋 — 時間差で2本、広がりながら消える（アプリと同じ式）
    const d = stage.getBoundingClientRect().width;
    ripples.forEach((el, i) => {
      const q = phase === "exhale" && !reduced ? (p - RIPPLE_DELAYS[i]) / (1 - RIPPLE_DELAYS[i]) : 0;
      if (q <= 0) { el.style.opacity = 0; return; }
      const travel = easeOut(q);
      const size = d * (1 + (RIPPLE_REACH - 1) * travel);
      el.style.width = el.style.height = `${size}px`;
      el.style.opacity = 0.22 * (1 - travel) * Math.min(q / 0.08, 1);
    });
    // 切り替えの1秒は文字を変えない
    if ((phase === "inhale" || phase === "exhale") && phase !== lastPhase) {
      phaseText.textContent = root.dataset[phase];
      lastPhase = phase;
    }
    // 何呼吸目かだけ（アプリと同じ — 「/ 6」の残りは出さない）
    countText.textContent = String(Math.min(Math.floor(sec / PERIOD) + 1, REPEAT));
  }

  function frame(now) {
    const sec = (now - startedAt) / 1000;
    if (sec >= TOTAL) { finish(); return; }
    render(sec);
    raf = requestAnimationFrame(frame);
  }

  function begin() {
    done.hidden = true;
    stage.hidden = false;
    lastProgress = -1; lastPhase = "";
    fitCanvas(canvas);
    startedAt = performance.now();
    ring();
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    cancelAnimationFrame(raf);
    raf = 0;
    paintEnso(canvas, 1);
    canvas.style.opacity = 1;
    canvas.style.transform = "";
    ripples.forEach((el) => { el.style.opacity = 0; });
    phaseText.textContent = "";
    countText.textContent = "";
    done.hidden = false;
    ring();
    done.querySelector("a, button")?.focus();
  }

  async function open(event) {
    opener = event.currentTarget;
    root.hidden = false;
    document.documentElement.classList.add("is-breathing");
    root.querySelector("[data-breath-close]").focus();
    await loadTrail();
    begin();
  }

  function close() {
    cancelAnimationFrame(raf);
    raf = 0;
    root.hidden = true;
    document.documentElement.classList.remove("is-breathing");
    opener?.focus();
  }

  document.querySelectorAll("[data-breath-open]").forEach((b) => b.addEventListener("click", open));
  root.querySelector("[data-breath-close]").addEventListener("click", close);
  root.querySelector("[data-breath-again]")?.addEventListener("click", begin);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    // 開いているあいだは、フォーカスを呼吸の画面の中にとどめる
    const items = [...root.querySelectorAll("a, button")].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // 裏に回ったら止め、戻ったら止めた所から続ける
  document.addEventListener("visibilitychange", () => {
    if (!raf) return;
    if (document.hidden) { hiddenAt = performance.now(); cancelAnimationFrame(raf); }
    else { startedAt += performance.now() - hiddenAt; raf = requestAnimationFrame(frame); }
  });
}

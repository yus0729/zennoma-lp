// LP の動き — ①最初の円相を筆で描く ②「呼吸 → 集中 → また」をスクロールに合わせて進める。
// 動きを減らす設定・JS が無いときは、何も動かさずに全部をそのまま見せる（CSS の既定がその形）。
import { loadTrail, fitCanvas, paintEnso, strokeEase } from "./enso.js";

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
/** a〜b の区間での進み（0..1） */
const span = (x, a, b) => clamp01((x - a) / (b - a));

const repaints = [];
// 外観（墨／白）を切り替えたら、描いてある円相を同じ進みで描き直す
new MutationObserver(() => repaints.forEach((f) => f())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

loadTrail().then(() => {
  hero();
  loop();
});

// ① ページを開くと、筆が円相を一周描く（2.6秒）
function hero() {
  const canvas = document.querySelector("[data-hero-enso]");
  if (!canvas) return;
  let progress = motion.matches ? 1 : 0;
  const paint = () => { fitCanvas(canvas); paintEnso(canvas, progress); };
  repaints.push(paint);
  window.addEventListener("resize", paint);
  if (progress === 1) { paint(); return; }
  const start = performance.now() + 500;
  const step = (now) => {
    progress = strokeEase((now - start) / 2600);
    paint();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ② 「呼吸 → 集中 → また」— 場面を画面に留めたまま、スクロールの量で円相と集中の輪を進める
function loop() {
  const section = document.querySelector("[data-loop]");
  if (!section || motion.matches) return;
  section.classList.add("is-live");
  const canvas = section.querySelector("[data-loop-enso]");
  const ring = section.querySelector("[data-loop-ring]");
  const arc = ring.querySelector(".ring-arc");
  const head = ring.querySelector(".ring-head");
  const steps = [...section.querySelectorAll("[data-loop-step]")];
  let ensoProgress = 0, queued = false;

  function update() {
    queued = false;
    const box = section.getBoundingClientRect();
    const p = clamp01(-box.top / Math.max(box.height - window.innerHeight, 1));
    // 呼吸（0〜0.34）: 筆が円相を描く / 集中（0.34〜0.7）: 円相が消えて細い輪が満ちる / また（0.7〜）: 輪が消えて円相がもう一度
    const active = p < 0.34 ? 0 : p < 0.7 ? 1 : 2;
    steps.forEach((el, i) => el.classList.toggle("is-active", i === active));
    // 場面が画面に留まる前（下から上がってくるあいだ）から描き始める — 留まった瞬間に空っぽの枠を見せない
    const entry = clamp01((window.innerHeight - box.top) / window.innerHeight);
    const draw = p < 0.34 ? 0.55 * entry + 0.45 * span(p, 0, 0.28) : p < 0.74 ? 1 : span(p, 0.76, 0.96);
    const ensoInk = p < 0.34 ? 1 : p < 0.74 ? 1 - span(p, 0.34, 0.4) : span(p, 0.74, 0.78);
    const ringInk = p < 0.7 ? span(p, 0.36, 0.42) : 1 - span(p, 0.7, 0.76);
    const fill = span(p, 0.42, 0.66);
    if (draw !== ensoProgress) { ensoProgress = draw; paintEnso(canvas, draw); }
    canvas.style.opacity = ensoInk;
    ring.style.opacity = ringInk;
    arc.style.strokeDasharray = `${fill} 1`;
    // 輪の先の点 — 12時から時計回り
    const a = fill * 2 * Math.PI;
    head.setAttribute("cx", (100 + 84 * Math.sin(a)).toFixed(2));
    head.setAttribute("cy", (100 - 84 * Math.cos(a)).toFixed(2));
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  const paint = () => { fitCanvas(canvas); paintEnso(canvas, ensoProgress); };
  repaints.push(paint);
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", () => { paint(); queue(); });
  paint();
  update();

}

// 筆で描かれる円相 — アプリ（web/src/lib/enso.ts・iOS EnsoShape）と同じ仕組みの LP 版。
// 原画から起こした筆の軌跡（/assets/enso.json — 元は assets/enso.json、scripts/sync-shared.sh が写す）を読み、
// 「中心からの扇形 + 筆先の楕円」で原画を切り抜いて、筆が通ったところだけを見せる。
// progress=1 では原画そのもの。軌跡が読めないときは原画だけを出す。

/** "M x y L x y ..." を点の並びに変える（0〜1 の比率） */
function parsePoints(d) {
  // 記号（M / L）だけの区切りは飛ばす — 空の文字を数にすると 0 になってしまう
  const nums = d.split(/[\s,]+/).map((t) => t.replace(/^[A-Za-z]/, "")).filter((t) => t !== "").map(Number).filter(Number.isFinite);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

/** 窓をずらしながら、中央値か平均でならす。端では窓を縮める */
function filtered(values, window, pick) {
  if (values.length <= window || window <= 1) return values;
  const half = Math.floor(window / 2);
  return values.map((_, i) => pick(values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))));
}
const median = (w) => w.slice().sort((a, b) => a - b)[Math.floor(w.length / 2)];
const mean = (w) => w.reduce((s, v) => s + v, 0) / w.length;

function centroid(points) {
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}

/** 角度は保ったまま半径だけを 中央値(11)→平均(41) でならす（アプリと同じ） */
function smoothed(points, c) {
  const radii = points.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const steady = filtered(filtered(radii, 11, median), 41, mean);
  return points.map((p, i) => {
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    return { x: c.x + Math.cos(a) * steady[i], y: c.y + Math.sin(a) * steady[i] };
  });
}

let trail = null;

/** 軌跡を一度だけ読む。読めなくても描画は原画だけで続ける */
export async function loadTrail() {
  if (trail) return trail;
  try {
    const source = await (await fetch("/assets/enso.json")).json();
    const rawOuter = parsePoints(source.outer);
    const rawInner = parsePoints(source.inner);
    if (rawOuter.length <= 2 || rawOuter.length !== rawInner.length) return null;
    const rough = centroid(rawOuter);
    const outer = smoothed(rawOuter, rough);
    const inner = smoothed(rawInner, rough);
    let maxHalf = 0;
    outer.forEach((p, i) => { maxHalf = Math.max(maxHalf, Math.hypot(p.x - inner[i].x, p.y - inner[i].y) / 2); });
    trail = { outer, inner, center: centroid(outer), maxHalf };
  } catch { trail = null; }
  return trail;
}

/** 筆がそこまで進んだ形。"full" = 原画そのまま、"empty" = 何も出さない */
function clipPath(progress, w, h) {
  const t = Math.min(Math.max(progress, 0), 1);
  if (t <= 0) return "empty";
  if (t >= 1 || !trail) return "full";
  const { outer, inner, center: c0 } = trail;
  const place = (p) => ({ x: p.x * w, y: p.y * h });
  const angleOf = (p) => Math.atan2(p.y - c0.y, p.x - c0.x);
  // 筆先は点と点のあいだを補間してなめらかに進める
  const exact = (outer.length - 1) * t;
  const lo = Math.min(Math.floor(exact), outer.length - 2);
  const f = exact - lo;
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  const oTip = lerp(outer[lo], outer[lo + 1]);
  const iTip = lerp(inner[lo], inner[lo + 1]);
  // 扇の開き = 描き始めから筆の中心線まで。進み具合から期待される角度に最も近い候補を選ぶ
  const start = angleOf(outer[0]);
  let sweep = angleOf({ x: (oTip.x + iTip.x) / 2, y: (oTip.y + iTip.y) / 2 }) - start;
  const expected = t * 2 * Math.PI;
  while (sweep < expected - Math.PI) sweep += 2 * Math.PI;
  while (sweep > expected + Math.PI) sweep -= 2 * Math.PI;
  sweep = Math.min(Math.max(sweep, 0), 2 * Math.PI);

  const c = place(c0);
  const reach = Math.hypot(w, h);
  const path = new Path2D();
  path.moveTo(c.x, c.y);
  const steps = Math.max(Math.floor(sweep / 0.05), 2);
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    path.lineTo(c.x + Math.cos(a) * reach, c.y + Math.sin(a) * reach);
  }
  path.closePath();

  // 筆先 — 進む向きにわずかに伸びた楕円。かすれた区間で細くなりすぎないよう下限を置く（アプリと同じ数値）
  const o = place(oTip), n = place(iTip);
  const cap = { x: (o.x + n.x) / 2, y: (o.y + n.y) / 2 };
  const floorHalf = trail.maxHalf * Math.min(w, h) * 0.85 * Math.min(t / 0.25, 1);
  const r = Math.max(Math.hypot(o.x - n.x, o.y - n.y) / 2, floorHalf) * 1.12;
  if (r > 0.5) {
    const prev = place({ x: (outer[lo].x + inner[lo].x) / 2, y: (outer[lo].y + inner[lo].y) / 2 });
    const dir = Math.atan2(cap.y - prev.y, cap.x - prev.x);
    path.ellipse(cap.x + Math.cos(dir) * r * 0.15, cap.y + Math.sin(dir) * r * 0.15, r * 1.35, r, dir, 0, 2 * Math.PI);
  }
  return path;
}

const images = new Map();
/** 原画は面ごとに一度だけ読む */
function imageFor(src) {
  if (!images.has(src)) { const img = new Image(); img.src = src; images.set(src, img); }
  return images.get(src);
}

/** いまの外観（墨／白）に合う原画 */
export function currentSource() {
  return document.documentElement.dataset.theme === "light" ? "/assets/enso-on-paper.png" : "/assets/enso-on-ink.png";
}

/** canvas の大きさを表示の大きさ×画面の細かさ（最大2倍）に合わせる */
export function fitCanvas(canvas) {
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const size = Math.round(canvas.getBoundingClientRect().width * ratio);
  if (size > 0 && canvas.width !== size) { canvas.width = size; canvas.height = size; }
}

/** 進みぶんだけ円相を描く。原画がまだなら届いたときに描く */
export function paintEnso(canvas, progress) {
  const img = imageFor(currentSource());
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const clip = clipPath(progress, canvas.width, canvas.height);
    if (clip === "empty") return;
    ctx.save();
    if (clip !== "full") ctx.clip(clip);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };
  if (img.complete && img.naturalWidth > 0) draw();
  else img.addEventListener("load", draw, { once: true });
}

// ── 呼吸の曲線（web/src/lib/breathing.ts と同じ式）──
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
export const easeInOut = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
export const easeOut = (p) => { const x = clamp01(p); return 1 - (1 - x) * (1 - x); };

/** 筆を置いて、走らせて、抜く */
export function strokeEase(t) {
  const x = clamp01(t);
  if (x < 0.18) return 0.07 * easeInOut(x / 0.18);
  if (x < 0.82) return 0.07 + 0.85 * ((x - 0.18) / 0.64);
  return 0.92 + 0.08 * easeOut((x - 0.82) / 0.18);
}

/** 吸う息に合わせて描く — 90%までは息と同期し、最後だけ描き切る */
export function inhaleDraw(p) {
  const x = clamp01(p);
  const j = 0.86;
  if (x < j) return (0.9 * easeInOut((0.93 * x) / j)) / easeInOut(0.93);
  if (x < 0.95) { const t = (x - j) / (0.95 - j); return 0.9 + 0.1 * (0.35 * t + 0.65 * t * t); }
  return 1;
}

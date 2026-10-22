// サイト共通 — 外観（墨／白）の切り替えと、画面に入った段落をそっと見せることだけ。通信・計測は行わない。
// LP だけの動き（円相・呼吸の体験・スクロールの場面）は /lp/ の下にある。
const root = document.documentElement;
const japanese = root.lang === "ja";
const themeButton = document.querySelector("[data-theme-toggle]");

function updateTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#fafbfc" : "#050506");
  if (!themeButton) return;
  themeButton.hidden = false;
  themeButton.setAttribute("aria-label", theme === "light"
    ? (japanese ? "墨の外観にする" : "Use the ink theme")
    : (japanese ? "白の外観にする" : "Use the light theme"));
}
try { updateTheme(localStorage.getItem("zennoma.site.theme") === "light" ? "light" : "dark"); }
catch { updateTheme("dark"); }
themeButton?.addEventListener("click", () => {
  const theme = root.dataset.theme === "light" ? "dark" : "light";
  updateTheme(theme);
  try { localStorage.setItem("zennoma.site.theme", theme); } catch { /* 保存できなくても切り替える */ }
});

// 動きを減らす設定や古いブラウザでは、最初から全部を見せる
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  root.classList.add("has-observer");
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

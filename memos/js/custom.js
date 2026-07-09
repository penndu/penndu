// Toggle Darkmode 适配 stellar 主题
// Stellar 存储key: stellar-theme，类名: dark / light
const storageKey = "stellar-theme";
const localTheme = window.localStorage && window.localStorage.getItem(storageKey);
const themeToggle = document.querySelector(".theme-toggle");

// 初始化
if (localTheme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(localTheme);
}

themeToggle.addEventListener("click", () => {
  const hasThemeClass = document.body.classList.contains("dark") || document.body.classList.contains("light");
  const isOSDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (!hasThemeClass) {
    // 无手动设置，反向系统默认
    document.body.classList.add(isOSDark ? "light" : "dark");
  } else {
    // 切换明暗
    document.body.classList.toggle("light");
    document.body.classList.toggle("dark");
  }

  // 同步存储 stellar 标准key
  if (window.localStorage) {
    const current = document.body.classList.contains("dark") ? "dark" : "light";
    window.localStorage.setItem(storageKey, current);
  }
});
// Darkmode End
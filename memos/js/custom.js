// 只保留切换按钮点击调用原生逻辑，删除全部你写的darkmode代码
const themeToggle = document.querySelector(".theme-toggle");
themeToggle.addEventListener("click", () => {
  // Stellar 全局暴露的主题切换函数
  window.stellar.toggleTheme();
});
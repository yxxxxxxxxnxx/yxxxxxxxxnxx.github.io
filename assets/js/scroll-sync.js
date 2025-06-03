document.addEventListener("DOMContentLoaded", function () {
  // 모든 left/right-panel 쌍을 찾음
  const leftPanels = document.querySelectorAll("[class^='left-panel']");
  leftPanels.forEach(leftPanel => {
    // right-panel 쌍 찾기 (left-panel2 → right-panel2, left-panel → right-panel)
    let rightPanel = null;
    if (leftPanel.classList.contains('left-panel2')) {
      rightPanel = document.querySelector('.right-panel2');
    } else {
      rightPanel = document.querySelector('.right-panel');
    }
    if (!rightPanel) return;

    leftPanel.addEventListener("wheel", function (event) {
      if (rightPanel.scrollHeight > rightPanel.clientHeight) {
        if (
          (event.deltaY < 0 && rightPanel.scrollTop > 0) ||
          (event.deltaY > 0 && rightPanel.scrollTop < rightPanel.scrollHeight - rightPanel.clientHeight)
        ) {
          event.preventDefault();
          rightPanel.scrollTop += event.deltaY;
        }
      }
    });
  });
});
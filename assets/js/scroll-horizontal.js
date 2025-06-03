function smoothScrollTo(targetY, duration = 1200) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + diff * progress);
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}

document.addEventListener("DOMContentLoaded", function () {
  const topPanel = document.querySelector(".top-panel");
  const postList = topPanel?.querySelector(".post-list");
  const leftPanel = document.querySelector(".left-panel");
  if (!topPanel || !postList || !leftPanel) return;

  function onWheel(event) {
    if (event.deltaY !== 0) {
      event.preventDefault();
      postList.scrollLeft += event.deltaY;

      const distanceToEnd = postList.scrollWidth - postList.clientWidth - postList.scrollLeft;
      if (distanceToEnd < 20) {
        postList.scrollLeft = 0;
        smoothScrollTo(leftPanel.getBoundingClientRect().top + window.scrollY, 180)
        topPanel.removeEventListener("wheel", onWheel, { passive: false });
      }
    }
  }

  topPanel.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("scroll", function onScroll() {
    if (window.scrollY === 0) {
      topPanel.addEventListener("wheel", onWheel, { passive: false });
    }
  });
});
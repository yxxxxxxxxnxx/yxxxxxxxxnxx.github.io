document.addEventListener("DOMContentLoaded", function () {
  const pagination = document.querySelector(".pagination");
  const topPanel   = document.querySelector(".top-panel");
  const postList   = topPanel?.querySelector(".post-list");

  if (!pagination || !topPanel || !postList) {
    console.warn("scroll-sync: required elements not found.");
    return;
  }

  // 누락된 smoothScrollTo 함수 구현
  function smoothScrollTo(target, duration, callback) {
    const start = window.scrollY;
    const distance = target - start;
    let startTime = null;

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // easeInOutQuad 이징 함수 적용
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      window.scrollTo(0, start + distance * ease);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        if (callback) callback();
      }
    }
    requestAnimationFrame(animation);
  }

  const html = document.documentElement;

  // ─────────────────────────────────────────────
  // 1. 헤더 scroll-status 동기화
  // ─────────────────────────────────────────────
  function setScrollStatus(status) {
    if (html.getAttribute("data-scroll-status") !== status) {
      html.setAttribute("data-scroll-status", status);
    }
  }

  let lastWindowY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if      (y === 0)          setScrollStatus("top");
    else if (y > lastWindowY)  setScrollStatus("down");
    else                       setScrollStatus("up");
    lastWindowY = y;
  }, { passive: true });

  let lastPagY = pagination.scrollTop;
  pagination.addEventListener("scroll", () => {
    const y = pagination.scrollTop;
    if      (y === 0)       setScrollStatus("top");
    else if (y > lastPagY)  setScrollStatus("down");
    else                    setScrollStatus("up");
    lastPagY = y;
  }, { passive: true });


  // ─────────────────────────────────────────────
  // 2. Top Panel: 세로 휠/터치 → 가로 스크롤 변환
  // ─────────────────────────────────────────────
  let topPanelTouchY = null;
  topPanel.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    topPanelTouchY = e.touches[0].clientY;
  }, { passive: true });

  topPanel.addEventListener("touchmove", function (e) {
    if (e.touches.length !== 1 || topPanelTouchY === null) return;

    const y = e.touches[0].clientY;
    const deltaY = topPanelTouchY - y;
    topPanelTouchY = y;
    if (deltaY === 0) return;

    const scrollable = postList.scrollWidth > postList.clientWidth;
    if (!scrollable) return;

    const atLeft  = postList.scrollLeft <= 0;
    // 소수점 오차 보정 (Math.ceil 적용)
    const atRight = Math.ceil(postList.scrollLeft + postList.clientWidth) >= postList.scrollWidth;

    if ((deltaY < 0 && !atLeft) || (deltaY > 0 && !atRight)) {
      e.preventDefault();
      postList.scrollLeft += deltaY;
    }
  }, { passive: false });

  topPanel.addEventListener("wheel", function (e) {
    if (e.deltaY === 0) return;

    const scrollable = postList.scrollWidth > postList.clientWidth;
    if (!scrollable) return;

    const atLeft  = postList.scrollLeft <= 0;
    // 소수점 오차 보정 (Math.ceil 적용)
    const atRight = Math.ceil(postList.scrollLeft + postList.clientWidth) >= postList.scrollWidth;

    if ((e.deltaY < 0 && !atLeft) || (e.deltaY > 0 && !atRight)) {
      e.preventDefault();
      postList.scrollLeft += e.deltaY;
    }
  }, { passive: false });


  // ─────────────────────────────────────────────
  // 3. Left Panel 휠/터치 → Right Panel 스크롤 동기화
  // ─────────────────────────────────────────────
  document.querySelectorAll("[class^='left-panel']").forEach((left) => {
    const suffix = left.className.match(/left-panel(\d*)/)?.[1] ?? "";
    const right  = document.querySelector(`.right-panel${suffix}`);
    if (!right) return;

    let leftPanelTouchY = null;

    left.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      leftPanelTouchY = e.touches[0].clientY;
    }, { passive: true });

    left.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 1 || leftPanelTouchY === null) return;

      const y = e.touches[0].clientY;
      const deltaY = leftPanelTouchY - y;
      leftPanelTouchY = y;
      if (deltaY === 0) return;

      const scrollable = right.scrollHeight > right.clientHeight;
      if (!scrollable) return;

      const atTop    = right.scrollTop <= 0;
      // 소수점 오차 보정 (Math.ceil 적용)
      const atBottom = Math.ceil(right.scrollTop + right.clientHeight) >= right.scrollHeight;

      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        e.preventDefault();
        right.scrollTop += deltaY;
      }
    }, { passive: false });

    left.addEventListener("wheel", function (e) {
      if (window.innerWidth <= 600) return;
      const scrollable = right.scrollHeight > right.clientHeight;
      if (!scrollable) return;

      const atTop    = right.scrollTop <= 0;
      // 소수점 오차 보정 (Math.ceil 적용)
      const atBottom = Math.ceil(right.scrollTop + right.clientHeight) >= right.scrollHeight;

      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
        e.preventDefault();
        right.scrollTop += e.deltaY;
      }
    }, { passive: false });
  });


  // ─────────────────────────────────────────────
  // 4. 페이지 최하단 → 위로 스크롤 시 pagination으로 복귀
  // ─────────────────────────────────────────────
  let snapping = false;
  let pageTouchStartY = null;

  window.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    pageTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", function (e) {
    if (e.touches.length !== 1 || pageTouchStartY === null) return;
    if (snapping) return;

    const y = e.touches[0].clientY;
    const deltaY = pageTouchStartY - y;
    pageTouchStartY = y;
    
    // 수정: 위로 스크롤(스와이프 다운, deltaY < 0) 시에만 동작하도록 조건 변경
    if (deltaY >= 0) return;

    const distToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);
    if (distToBottom < window.innerHeight * 0.5) {
      const target = pagination.getBoundingClientRect().top + window.scrollY;
      e.preventDefault();
      snapping = true;
      smoothScrollTo(target, 300, () => { snapping = false; });
    }
  }, { passive: false });

  window.addEventListener("touchend", function () {
    pageTouchStartY = null;
  }, { passive: true });
  window.addEventListener("touchcancel", function () {
    pageTouchStartY = null;
  }, { passive: true });

  window.addEventListener("wheel", function (e) {
    if (window.innerWidth <= 600) return;
    if (snapping) return;

    const distToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);
    if (e.deltaY < 0 && distToBottom < window.innerHeight * 0.5) {
      const target = pagination.getBoundingClientRect().top + window.scrollY;
      e.preventDefault();
      snapping = true;
      smoothScrollTo(target, 300, () => { snapping = false; });
    }
  }, { passive: false });

});
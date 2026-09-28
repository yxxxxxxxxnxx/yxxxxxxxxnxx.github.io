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
  // 2. Top Panel: 세로 휠 → 가로 스크롤 변환
  // ─────────────────────────────────────────────
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
  document.querySelectorAll(".panels-wrapper").forEach((wrapper) => {
    const left  = wrapper.querySelector(".left-panel");
    const right = wrapper.querySelector(".right-panel");
    if (!left || !right) return;

    // right-panel이 deltaY 방향으로 더 스크롤될 수 있는지
    function canScrollRight(deltaY) {
      if (right.scrollHeight <= right.clientHeight) return false;

      const atTop    = right.scrollTop <= 0;
      // 소수점 오차 보정 (Math.ceil 적용)
      const atBottom = Math.ceil(right.scrollTop + right.clientHeight) >= right.scrollHeight;

      return (deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom);
    }

    left.addEventListener("wheel", function (e) {
      if (canScrollRight(e.deltaY)) {
        e.preventDefault();
        right.scrollTop += e.deltaY;
      }
    }, { passive: false });

    // 터치 (iPad 등 데스크톱 배치의 터치 기기)
    // iOS는 첫 touchmove에서 스크롤 주체를 결정하므로, 제스처 시작 시 한 번만 판단한다.
    // right-panel이 그 방향으로 스크롤 가능하면 제스처 전체를 right-panel로 넘기고,
    // 끝에 닿아 있으면 기본 동작(.pagination 스크롤/스냅)에 맡긴다.
    let touchY    = null;
    let driving   = null;
    let velocity  = 0;   // px/ms
    let lastTime  = 0;
    let momentumId = null;

    function stopMomentum() {
      if (momentumId !== null) cancelAnimationFrame(momentumId);
      momentumId = null;
    }

    // 관성 스크롤: 손을 뗀 속도로 이어서 감속
    function startMomentum(v) {
      let prev = performance.now();
      function step(now) {
        const dt = now - prev;
        prev = now;
        right.scrollTop += v * dt;
        v *= Math.pow(0.95, dt / 16);
        momentumId = (Math.abs(v) > 0.02 && canScrollRight(v)) ? requestAnimationFrame(step) : null;
      }
      momentumId = requestAnimationFrame(step);
    }

    // right-panel을 직접 터치해도 진행 중인 관성을 멈춘다
    wrapper.addEventListener("touchstart", stopMomentum, { passive: true });

    left.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) {
        touchY = null;
        return;
      }
      touchY   = e.touches[0].clientY;
      driving  = null;
      velocity = 0;
      lastTime = e.timeStamp;
    }, { passive: true });

    left.addEventListener("touchmove", function (e) {
      if (touchY === null || e.touches.length !== 1) return;

      const y      = e.touches[0].clientY;
      const deltaY = touchY - y;

      if (driving === null) {
        if (deltaY === 0) return;
        driving = canScrollRight(deltaY);
      }
      if (!driving) return;

      e.preventDefault();
      right.scrollTop += deltaY;

      const dt = Math.max(e.timeStamp - lastTime, 1);
      velocity = 0.8 * (deltaY / dt) + 0.2 * velocity;
      lastTime = e.timeStamp;
      touchY   = y;
    }, { passive: false });

    function endTouch(e) {
      // 손가락을 멈췄다가 뗀 경우(100ms 이상)에는 관성을 주지 않는다
      if (driving && e.timeStamp - lastTime < 100 && Math.abs(velocity) > 0.05) {
        startMomentum(velocity);
      }
      touchY  = null;
      driving = null;
    }

    left.addEventListener("touchend", endTouch, { passive: true });
    left.addEventListener("touchcancel", endTouch, { passive: true });
  });


  // ─────────────────────────────────────────────
  // 4. 페이지 최하단 → 위로 스크롤 시 pagination으로 복귀
  // ─────────────────────────────────────────────
  let snapping = false;

  window.addEventListener("wheel", function (e) {
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
document.addEventListener("DOMContentLoaded", function () {
  const pagination = document.querySelector(".pagination");
  const topPanel   = document.querySelector(".top-panel");
  const postList   = topPanel?.querySelector(".post-list");

  if (!pagination || !topPanel || !postList) {
    console.warn("scroll-sync: required elements not found.");
    return;
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
    const atRight = postList.scrollLeft >= postList.scrollWidth - postList.clientWidth;

    if ((e.deltaY < 0 && !atLeft) || (e.deltaY > 0 && !atRight)) {
      e.preventDefault();
      postList.scrollLeft += e.deltaY;
    }
  }, { passive: false });


  // ─────────────────────────────────────────────
  // 3. Left Panel 휠 → Right Panel 스크롤 동기화
  // ─────────────────────────────────────────────
  document.querySelectorAll("[class^='left-panel']").forEach((left) => {
    const suffix = left.className.match(/left-panel(\d*)/)?.[1] ?? "";
    const right  = document.querySelector(`.right-panel${suffix}`);
    if (!right) return;

    left.addEventListener("wheel", function (e) {
      if (window.innerWidth <= 600) return;
      const scrollable = right.scrollHeight > right.clientHeight;
      if (!scrollable) return;

      const atTop    = right.scrollTop <= 0;
      const atBottom = right.scrollTop >= right.scrollHeight - right.clientHeight;

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


  // ─────────────────────────────────────────────
  // 5. on-palm 전용: 휠/터치로 snap 직접 구현
  // ─────────────────────────────────────────────
  if (window.innerWidth <= 600) {
    const leftPanels = Array.from(document.querySelectorAll(
      ".left-panel, .left-panel2, .left-panel3, .left-panel4, .left-panel5"
    ));

    // snap 시퀀스: top → left1 → right1 → left2 → right2 → ...
    const sequence = [topPanel];
    leftPanels.forEach(left => {
      sequence.push(left);
      const suffix = left.className.match(/left-panel(\d*)/)?.[1] ?? "";
      const right = document.querySelector(`.right-panel${suffix}`);
      if (right) sequence.push(right);
    });

    function getPagOffset(el) {
      return el.getBoundingClientRect().top
        - pagination.getBoundingClientRect().top
        + pagination.scrollTop;
    }

    let cooldown = false;

    function snapTo(scrollPos) {
      cooldown = true;
      smoothScrollElementTo(pagination, Math.round(scrollPos), 500, () => {
        setTimeout(() => { cooldown = false; }, 200);
      });
    }

    function handleSnap(direction, curScroll, preventDefault) {
      const pagH = pagination.clientHeight;

      let currentIdx = 0;
      sequence.forEach((el, i) => {
        if (getPagOffset(el) <= curScroll + pagH * 0.3) currentIdx = i;
      });

      const currentEl = sequence[currentIdx];
      const isRight   = currentEl.className.includes("right-panel");

      if (isRight) {
        const rightTop    = getPagOffset(currentEl);
        const rightBottom = rightTop + currentEl.offsetHeight;

        if (direction > 0 && curScroll + pagH >= rightBottom - 10) {
          preventDefault();
          const next = sequence[currentIdx + 1];
          if (next) snapTo(getPagOffset(next));
        } else if (direction < 0 && curScroll <= rightTop + 10) {
          preventDefault();
          snapTo(getPagOffset(sequence[currentIdx - 1]));
        }
        // 경계 아니면 자연 스크롤
        return;
      }

      // top-panel / left-panel: 즉시 snap
      preventDefault();
      if (direction > 0) {
        const next = sequence[currentIdx + 1];
        if (next) snapTo(getPagOffset(next));
      } else {
        const prev = sequence[currentIdx - 1];
        if (prev) snapTo(getPagOffset(prev));
      }
    }

    // ── pagination 내부 snap (wheel — PC/트랙패드) ────
    pagination.addEventListener("wheel", function (e) {
      if (cooldown) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 10) return;
      handleSnap(e.deltaY > 0 ? 1 : -1, pagination.scrollTop, () => e.preventDefault());
    }, { passive: false });

    // ── pagination 내부 snap (touch — 모바일) ─────────
    let touchStartY = 0;

    pagination.addEventListener("touchstart", function (e) {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    pagination.addEventListener("touchend", function (e) {
      if (cooldown) return;
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 30) return;
      handleSnap(deltaY > 0 ? 1 : -1, pagination.scrollTop, () => {});
    }, { passive: true });

    // ── 푸터 → pagination 복귀 (wheel) ────────────────
    let windowCooldown = false;

    window.addEventListener("wheel", function (e) {
      if (windowCooldown) { e.preventDefault(); return; }

      const distToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);
      if (distToBottom < window.innerHeight * 0.5 && e.deltaY < 0) {
        e.preventDefault();
        windowCooldown = true;
        smoothScrollTo(pagination.getBoundingClientRect().top + window.scrollY, 500, () => {
          setTimeout(() => { windowCooldown = false; }, 200);
        });
      }
    }, { passive: false });

    // ── 푸터 → pagination 복귀 (touch — 모바일) ───────
    let windowTouchStartY = 0;

    window.addEventListener("touchstart", function (e) {
      windowTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener("touchend", function (e) {
      if (windowCooldown) return;

      const deltaY = windowTouchStartY - e.changedTouches[0].clientY;
      const distToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);

      if (distToBottom < window.innerHeight * 0.5 && deltaY < -30) {
        windowCooldown = true;
        smoothScrollTo(pagination.getBoundingClientRect().top + window.scrollY, 500, () => {
          setTimeout(() => { windowCooldown = false; }, 200);
        });
      }
    }, { passive: true });

  } // end on-palm

});
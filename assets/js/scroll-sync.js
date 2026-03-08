document.addEventListener("DOMContentLoaded", function () {
  const pagination    = document.querySelector(".pagination");
  const topPanel      = document.querySelector(".top-panel");
  const postList      = topPanel?.querySelector(".post-list");

  if (!pagination || !topPanel || !postList) {
    console.warn("scroll-sync: required elements not found.");
    return;
  }

  const html = document.documentElement;

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
    if      (y === 0)        setScrollStatus("top");
    else if (y > lastPagY)   setScrollStatus("down");
    else                     setScrollStatus("up");
    lastPagY = y;
  }, { passive: true });


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
  // 5. on-palm 전용: 휠로 snap 직접 구현
  // ─────────────────────────────────────────────
  if (window.innerWidth <= 600) {
    const leftPanels = Array.from(document.querySelectorAll(
      ".left-panel, .left-panel2, .left-panel3, .left-panel4, .left-panel5"
    ));

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
        setTimeout(() => { cooldown = false; }, 200);  // 스크롤 후 200ms 쿨다운
      });
    }

    // ── pagination 내부 snap ──────────────────────────
    pagination.addEventListener("wheel", function (e) {
      if (cooldown) { e.preventDefault(); return; }

      const direction = e.deltaY > 0 ? 1 : -1;
      const curScroll = pagination.scrollTop;
      const pagH      = pagination.clientHeight;

      // deltaY 임계값 — 너무 작은 스크롤 무시 (민감도 조절)
      if (Math.abs(e.deltaY) < 10) return;

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
          e.preventDefault();
          const next = sequence[currentIdx + 1];
          if (next) snapTo(getPagOffset(next));
        } else if (direction < 0 && curScroll <= rightTop + 10) {
          e.preventDefault();
          snapTo(getPagOffset(sequence[currentIdx - 1]));
        }
        // 경계 아니면 자연 스크롤
        return;
      }

      // top-panel / left-panel: 즉시 snap
      e.preventDefault();
      if (direction > 0) {
        const next = sequence[currentIdx + 1];
        if (next) snapTo(getPagOffset(next));
      } else {
        const prev = sequence[currentIdx - 1];
        if (prev) snapTo(getPagOffset(prev));
      }
    }, { passive: false });

    // ── 푸터 → pagination 복귀 (window 스크롤) ────────
    let windowCooldown = false;

    window.addEventListener("wheel", function (e) {
      if (window.innerWidth > 600) return;
      if (windowCooldown) { e.preventDefault(); return; }

      const distToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);
      const inFooter = distToBottom < window.innerHeight * 0.5;

      if (inFooter && e.deltaY < 0) {
        // 푸터에서 스크롤 업 → window를 pagination 위치로 복귀
        e.preventDefault();
        windowCooldown = true;
        smoothScrollTo(pagination.getBoundingClientRect().top + window.scrollY, 500, () => {
          setTimeout(() => { windowCooldown = false; }, 200);
        });
      }
    }, { passive: false });
  }

});
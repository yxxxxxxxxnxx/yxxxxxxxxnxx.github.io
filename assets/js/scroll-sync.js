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

});
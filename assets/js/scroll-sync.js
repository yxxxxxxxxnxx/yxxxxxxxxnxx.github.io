document.addEventListener("DOMContentLoaded", function () {
  const paginationElement = document.querySelector(".pagination");
  const topPanel = document.querySelector(".top-panel");
  const postList = topPanel?.querySelector(".post-list");
  const panelsWrapper = document.querySelector(".panels-wrapper");

  if (!paginationElement || !topPanel || !postList || !panelsWrapper) {
    console.warn("Required elements for scroll sync not found.");
    return;
  }

  // --- 1. 헤더 스크롤 상태 동기화 ---
  const html = document.documentElement;
  let lastWindowScrollY = window.scrollY;
  let lastPaginationScrollY = paginationElement.scrollTop;

  function setScrollStatus(status) {
    // 상태가 변할 때만 속성 변경 (DOM 조작 최소화)
    if (html.getAttribute("data-scroll-status") !== status) {
      html.setAttribute("data-scroll-status", status);
    }
  }

  // Window 스크롤 감지
  window.addEventListener("scroll", function () {
    const currentY = window.scrollY;
    if (currentY > lastWindowScrollY) {
      setScrollStatus("down");
    } else if (currentY < lastWindowScrollY) {
      setScrollStatus("up");
    } else if (currentY === 0) {
      setScrollStatus("top");
    }
    lastWindowScrollY = currentY;
  }, { passive: true });

  // Pagination 내부 스크롤 감지
  paginationElement.addEventListener("scroll", function () {
    const currentY = paginationElement.scrollTop;
    if (currentY > lastPaginationScrollY) {
      setScrollStatus("down");
    } else if (currentY < lastPaginationScrollY) {
      setScrollStatus("up");
    } else if (currentY === 0) {
      setScrollStatus("top");
    }
    lastPaginationScrollY = currentY;
  }, { passive: true });

  // --- 2. Left/Right Panel 스크롤 동기화 (로직 단순화) ---
  const leftPanels = document.querySelectorAll("[class^='left-panel']");

  leftPanels.forEach((leftPanel) => {
    // 클래스명에서 숫자 접미사 추출 (예: 'left-panel2' -> '2', 'left-panel' -> '')
    const suffix = leftPanel.className.replace("left-panel", "");
    const rightPanel = document.querySelector(`.right-panel${suffix}`);

    if (!rightPanel) return;

    leftPanel.addEventListener("wheel", function (event) {
      // 오른쪽 패널이 스크롤 가능한지 확인
      const isRightScrollable = rightPanel.scrollHeight > rightPanel.clientHeight;
      if (!isRightScrollable) return;

      const isScrollingUp = event.deltaY < 0;
      const isScrollingDown = event.deltaY > 0;
      const atTop = rightPanel.scrollTop <= 0;
      const atBottom = rightPanel.scrollTop >= rightPanel.scrollHeight - rightPanel.clientHeight;

      // 스크롤 가능한 방향일 때만 이벤트 가로채기
      if ((isScrollingUp && !atTop) || (isScrollingDown && !atBottom)) {
        event.preventDefault();
        rightPanel.scrollTop += event.deltaY;
      }
    }, { passive: false });
  });

  // --- 3. Top Panel 가로 스크롤 변환 ---
  function onWheelTopPanel(event) {
    if (event.deltaY === 0) return;

    const isScrollable = postList.scrollWidth > postList.clientWidth;
    if (!isScrollable) return;

    const isScrollingLeft = event.deltaY < 0;
    const isScrollingRight = event.deltaY > 0;
    const atLeft = postList.scrollLeft <= 0;
    const atRight = postList.scrollLeft >= postList.scrollWidth - postList.clientWidth;

    if ((isScrollingLeft && !atLeft) || (isScrollingRight && !atRight)) {
      event.preventDefault();
      postList.scrollLeft += event.deltaY;
    }
  }
  topPanel.addEventListener("wheel", onWheelTopPanel, { passive: false });

  // --- 4. 페이지 최하단(푸터) 스크롤 업 처리 ---
  let isScrollingToPagination = false;

  window.addEventListener("wheel", function (event) {
    const bodyHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollPosition = window.scrollY;
    const distanceToBottom = bodyHeight - (scrollPosition + windowHeight);

    // 하단 영역에서 스크롤 업 발생 시 Pagination 위치로 이동
    // main.js의 smoothScrollTo 사용
    if (event.deltaY < 0 && distanceToBottom < windowHeight * 0.5 && !isScrollingToPagination) {
      const paginationOffsetTop = paginationElement.getBoundingClientRect().top + window.scrollY;

      event.preventDefault();
      isScrollingToPagination = true;
      smoothScrollTo(paginationOffsetTop, 300);
      
      setTimeout(() => {
        isScrollingToPagination = false;
      }, 300);
    }
  }, { passive: false });

  // --- 5. Pagination 상단 도달 시 Top-Panel로 전환 ---
  paginationElement.addEventListener("wheel", function (event) {
    if (event.deltaY < 0 && paginationElement.scrollTop <= 0) {
      const topPanelOffsetTop = topPanel.getBoundingClientRect().top + window.scrollY;

      event.preventDefault();
      smoothScrollTo(topPanelOffsetTop, 180);
    }
  }, { passive: false });
});

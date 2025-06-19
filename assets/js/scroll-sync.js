document.addEventListener("DOMContentLoaded", function () {
  const paginationElement = document.querySelector(".pagination");
  const topPanel = document.querySelector(".top-panel");
  const postList = topPanel?.querySelector(".post-list");
  const panelsWrapper = document.querySelector(".panels-wrapper");

  if (!paginationElement || !topPanel || !postList || !panelsWrapper) {
    console.warn("Required elements for scroll sync not found.");
    return;
  }

  // ...기존 코드 (left/right-panel 동기화, top-panel 가로 스크롤 등)...

  // --- 헤더 스크롤 상태 동기화 추가 ---
  const html = document.documentElement;
  let lastWindowScrollY = window.scrollY;
  let lastPaginationScrollY = paginationElement.scrollTop;

  function setScrollStatus(status) {
    html.setAttribute('data-scroll-status', status);
  }

  // window 스크롤 감지
  window.addEventListener('scroll', function () {
    const currentY = window.scrollY;
    if (currentY > lastWindowScrollY) {
      setScrollStatus('down');
    } else if (currentY < lastWindowScrollY) {
      setScrollStatus('up');
    } else if (currentY === 0) {
      setScrollStatus('top');
    }
    lastWindowScrollY = currentY;
  });

  // pagination 내부 스크롤 감지
  paginationElement.addEventListener('scroll', function () {
    const currentY = paginationElement.scrollTop;
    if (currentY > lastPaginationScrollY) {
      setScrollStatus('down');
    } else if (currentY < lastPaginationScrollY) {
      setScrollStatus('up');
    } else if (currentY === 0) {
      setScrollStatus('top');
    }
    lastPaginationScrollY = currentY;
  });

  // ...기존 코드 (pagination wheel, smoothScrollTo 등)...
  // (아래 기존 코드 유지)
  // 1. 모든 left/right-panel 쌍에 대한 기존 스크롤 동기화 로직 (변화 없음)
  const leftPanels = document.querySelectorAll("[class^='left-panel']");
  leftPanels.forEach(leftPanel => {
    let rightPanel = null;
    if (leftPanel.classList.contains('left-panel2')) {
      rightPanel = document.querySelector('.right-panel2');
    } else if (leftPanel.classList.contains('left-panel3')) {
      rightPanel = document.querySelector('.right-panel3');
    } else if (leftPanel.classList.contains('left-panel4')) {
      rightPanel = document.querySelector('.right-panel4');
    } else if (leftPanel.classList.contains('left-panel5')) {
      rightPanel = document.querySelector('.right-panel5');
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
    }, { passive: false });
  });

  function onWheelTopPanel(event) {
    if (event.deltaY !== 0) {
      if (postList.scrollWidth > postList.clientWidth) {
        if (
          (event.deltaY < 0 && postList.scrollLeft > 0) ||
          (event.deltaY > 0 && postList.scrollLeft < postList.scrollWidth - postList.clientWidth)
        ) {
          event.preventDefault();
          postList.scrollLeft += event.deltaY;
        }
      }
    }
  }
  topPanel.addEventListener("wheel", onWheelTopPanel, { passive: false });

  // 3. 페이지 최하단 (푸터 영역)에서의 스크롤 업 처리
  let isScrollingToPagination = false;

  window.addEventListener("wheel", function (event) {
    const bodyHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollPosition = window.scrollY;
    const distanceToBottom = bodyHeight - (scrollPosition + windowHeight);
    const paginationOffsetTop = paginationElement.getBoundingClientRect().top + window.scrollY;

    const mouseY = event.clientY;
    const mouseX = event.clientX;
    const paginationRect = paginationElement.getBoundingClientRect();
    const isMouseInPagination = (
      mouseX >= paginationRect.left &&
      mouseX <= paginationRect.right &&
      mouseY >= paginationRect.top &&
      mouseY <= paginationRect.bottom
    );

    if (event.deltaY < 0 && distanceToBottom < windowHeight * 0.5 && !isScrollingToPagination) {
      event.preventDefault();
      isScrollingToPagination = true;
      smoothScrollTo(paginationOffsetTop, 300);
      setTimeout(() => {
        isScrollingToPagination = false;
      }, 300);
    }
  }, { passive: false });

  // 4. pagination 내부 스크롤이 최상단에 도달했을 때 top-panel 상단으로 전환
  paginationElement.addEventListener("wheel", function(event) {
    const topPanelOffsetTop = topPanel.getBoundingClientRect().top + window.scrollY;
    if (event.deltaY < 0 && paginationElement.scrollTop <= 0) {
      event.preventDefault();
      smoothScrollTo(topPanelOffsetTop, 180);
    }
  }, { passive: false });

});
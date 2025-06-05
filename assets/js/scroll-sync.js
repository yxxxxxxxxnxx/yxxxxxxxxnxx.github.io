// assets/js/scroll-sync.js

// 부드러운 스크롤 함수 (이제 window.scrollTo를 제어합니다)
function smoothScrollTo(targetY, duration = 300) { // 푸터 밀어낼 때 좀 더 빠르게
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
  const paginationElement = document.querySelector(".pagination");
  const topPanel = document.querySelector(".top-panel");
  const postList = topPanel?.querySelector(".post-list"); // top-panel 내부의 가로 스크롤 요소
  const panelsWrapper = document.querySelector(".panels-wrapper"); // 첫 번째 left/right-panel 쌍을 포함하는 요소

  if (!paginationElement || !topPanel || !postList || !panelsWrapper) {
    console.warn("Required elements for scroll sync not found.");
    return;
  }

  // 1. 모든 left/right-panel 쌍에 대한 기존 스크롤 동기화 로직 (변화 없음)
  const leftPanels = document.querySelectorAll("[class^='left-panel']");
  leftPanels.forEach(leftPanel => {
    let rightPanel = null;
    if (leftPanel.classList.contains('left-panel2')) {
      rightPanel = document.querySelector('.right-panel2');
    } else if (leftPanel.classList.contains('left-panel3')) {
      rightPanel = document.querySelector('.right-panel3');
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
        // else: rightPanel 내부 스크롤이 끝에 도달하면,
        //      event.preventDefault()를 호출하지 않아 pagination의 CSS 스냅이 작동하도록 합니다.
      }
    }, { passive: false });
  });


  // 2. top-panel의 가로 스크롤 로직 (이전 답변에서 수정된 버전)
  function onWheelTopPanel(event) {
    if (event.deltaY !== 0) {
      if (postList.scrollWidth > postList.clientWidth) { // top-panel에 가로 스크롤 가능 공간이 있을 때
        if (
          (event.deltaY < 0 && postList.scrollLeft > 0) ||
          (event.deltaY > 0 && postList.scrollLeft < postList.scrollWidth - postList.clientWidth)
        ) {
          event.preventDefault(); // top-panel 내부 가로 스크롤만 처리
          postList.scrollLeft += event.deltaY;
        }
        // else: top-panel 가로 스크롤이 끝에 도달하면,
        //       event.preventDefault() 호출 없이 pagination의 CSS 스냅이 작동하도록 합니다.
        //       따라서 다음 섹션 (.panels-wrapper)으로 스냅됩니다.
      }
    }
  }
  topPanel.addEventListener("wheel", onWheelTopPanel, { passive: false });


  // 3. 페이지 최하단 (푸터 영역)에서의 스크롤 업 처리
  //    pagination 영역에 마우스가 있을 때도 window 스크롤을 제어해야 합니다.
  let isScrollingToPagination = false; // 플래그를 사용하여 중복 스크롤 방지

  window.addEventListener("wheel", function (event) {
    // 푸터가 보이는 영역에서 위로 스크롤할 때만 작동
    const bodyHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollPosition = window.scrollY;
    const distanceToBottom = bodyHeight - (scrollPosition + windowHeight);
    const paginationOffsetTop = paginationElement.getBoundingClientRect().top + window.scrollY;

    // 현재 푸터가 충분히 보이고, 스크롤 방향이 위쪽일 때
    // 그리고 마우스 커서가 pagination 영역 내에 있을 때 (옵션)
    const mouseY = event.clientY;
    const mouseX = event.clientX;
    const paginationRect = paginationElement.getBoundingClientRect();
    const isMouseInPagination = (
      mouseX >= paginationRect.left &&
      mouseX <= paginationRect.right &&
      mouseY >= paginationRect.top &&
      mouseY <= paginationRect.bottom
    );

    // 조건:
    // 1. 스크롤을 위로 올리고 있다 (event.deltaY < 0)
    // 2. 현재 스크롤 위치가 페이지 최하단에 가깝다 (예: 푸터가 보일 정도)
    // 3. 아직 pagination으로 스크롤 중이 아니다 (isScrollingToPagination 플래그)
    if (event.deltaY < 0 && distanceToBottom < windowHeight * 0.5 && !isScrollingToPagination) { // 푸터 영역의 절반 정도 남았을 때 발동
      // 4. (선택적) 마우스가 pagination 영역 내에 있는 경우에만 발동하려면 isMouseInPagination 추가
      // (지금은 마우스 위치와 상관없이 푸터가 보이면 푸터 밀어내기)

      event.preventDefault(); // 기본 스크롤 동작 방지

      isScrollingToPagination = true; // 스크롤 시작 플래그 설정
      smoothScrollTo(paginationOffsetTop, 300); // pagination 상단으로 부드럽게 이동

      // 스크롤이 완료되면 플래그를 리셋 (duration에 맞게 조절)
      setTimeout(() => {
        isScrollingToPagination = false;
        // pagination 내부 스크롤을 다시 맨 아래로 설정 (선택 사항, 사용자 경험에 따라 결정)
        // paginationElement.scrollTop = paginationElement.scrollHeight - paginationElement.clientHeight;
      }, 300);
    }
    // 페이지 최상단에서 아래로 스크롤할 때 (top-panel이 보일 때)
    // else if (event.deltaY > 0 && window.scrollY === 0) {
    //   // top-panel의 가로 스크롤이 끝나고 pagination으로 진입할 때의 처리
    //   // 이 부분은 top-panel의 onWheelTopPanel이 이미 처리하고 있으므로 별도로 추가할 필요 없을 수 있습니다.
    //   // 필요시 smoothScrollTo(paginationOffsetTop, 300); 호출 가능
    // }
  }, { passive: false });


  // 4. pagination 내부 스크롤이 최상단에 도달했을 때 top-panel 상단으로 전환
  paginationElement.addEventListener("wheel", function(event) {
    const topPanelOffsetTop = topPanel.getBoundingClientRect().top + window.scrollY;

    // pagination 내부 스크롤이 맨 위에 도달했고, 스크롤을 위로 올리려 할 때
    if (event.deltaY < 0 && paginationElement.scrollTop <= 0) {
      event.preventDefault(); // pagination 내부 스크롤 방지
      // window.scrollTo(0, topPanelOffsetTop); // 즉시 이동 (CSS 스냅과 유사)
      smoothScrollTo(topPanelOffsetTop, 180); // 부드럽게 이동
    }
  }, { passive: false });


});
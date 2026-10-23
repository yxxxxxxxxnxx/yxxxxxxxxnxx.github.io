document.addEventListener("DOMContentLoaded", function () {
  const pagination = document.querySelector(".pagination");
  const topPanel   = document.querySelector(".top-panel");
  const postList   = topPanel?.querySelector(".post-list");

  if (!pagination || !topPanel || !postList) {
    console.warn("scroll-sync: required elements not found.");
    return;
  }

  // 홈의 패널들은 .pagination 박스 안에서 스크롤된다(패널 sticky). 문서(창)는 푸터를 보일 때만 움직인다.
  //
  // iOS Safari(26~)는 상태바(다이내믹 아일랜드)·하단 주소창 뒤에 화면 바깥 내용을 블러로 비춰 준다. 단,
  //  - 문서 기준 sticky·fixed 요소(화면 너비의 헤더 등)가 있으면 그 색으로 띠를 칠해 버리고,
  //  - 화면 맨 위에 sticky로 고정된 요소가 있으면 상태바에 단단한 띠를 덮고,
  //  - 문서가 맨 위(scrollY 0)이면 위쪽에 비출 내용이 없다.
  // 그래서 .pagination 박스를 화면보다 위아래로 BLEED만큼 크게 만들고 문서를 BLEED만큼 내려 둔 채로 쓴다.
  // 패널은 위아래 BLEED 여백을 두고 박스 맨 위(스크린 최상단)에 고정되어 상태바·주소창 뒤까지 채우고,
  // show-window는 박스 밖 배경 층(sticky 아님)으로 둔다. 데스크톱에서는 BLEED 영역이 화면 바깥이라 보이지 않는다.
  const html         = document.documentElement;
  const pageScroller = document.scrollingElement || document.documentElement;
  const palmQuery    = window.matchMedia("(max-width: 600px)"); // $on-palm과 동일
  const BLEED        = parseFloat(getComputedStyle(pagination).getPropertyValue("--panel-bleed")) || 0;

  // 새로고침해도 이전 스크롤 위치를 되살리지 않고 맨 위(show-window)에서 시작한다
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function viewport() {
    return window.innerHeight;
  }

  // 박스 높이 = 화면 + 위아래 BLEED, 문서는 BLEED만큼 내려 둔다 (푸터가 보이지 않는 상태).
  // --view-h: 화면 높이. CSS가 패널 내용·show-window 높이에 쓴다 (iOS의 100vh는 화면 높이와 다를 수 있어서).
  const showWindow = document.querySelector(".show-window");

  function sizeBox() {
    html.style.setProperty("--view-h", viewport() + "px");
    pagination.style.height = viewport() + BLEED * 2 + "px";
  }

  sizeBox();
  pagination.scrollTop = 0;
  window.scrollTo(0, BLEED);


  // ─────────────────────────────────────────────
  // 1. 헤더 scroll-status 동기화
  // ─────────────────────────────────────────────
  // 어디를 스크롤하든(pagination, right-panel, 창) 아래로 가면 헤더를 숨기고 위로 가면 보인다.
  // 스크롤 이벤트는 버블링되지 않으므로 캡처 단계에서 받는다. 가로 스크롤(top-panel 목록)은 무시한다.
  function setScrollStatus(status) {
    if (html.getAttribute("data-scroll-status") !== status) {
      html.setAttribute("data-scroll-status", status);
    }
  }

  const lastScrollTops = new WeakMap();

  function syncScrollStatus(el) {
    const y    = el.scrollTop;
    const last = lastScrollTops.has(el) ? lastScrollTops.get(el) : y;
    lastScrollTops.set(el, y);

    if (pagination.scrollTop === 0 && !footerShown()) setScrollStatus("top");
    else if (y !== last) setScrollStatus(y > last ? "down" : "up");
  }

  document.addEventListener("scroll", (e) => {
    if (e.target instanceof Element) syncScrollStatus(e.target);
  }, { capture: true, passive: true });

  // 창 스크롤: header.html도 같은 속성을 정하지만 문서가 늘 BLEED만큼 내려가 있어 "top"을 놓치므로,
  // 그보다 나중에 등록된 이 리스너가 홈 기준으로 다시 정한다.
  window.addEventListener("scroll", () => syncScrollStatus(pageScroller), { passive: true });


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
  // 3. 공통 도구: 스크롤 애니메이션, 스냅 지점 계산
  // ─────────────────────────────────────────────
  const animations = new Map();
  const wheelGoal  = new Map();   // 마우스 휠 한 칸을 부드럽게 옮기는 중인 요소 → 목적지 (6번)

  function stopAnimations() {
    animations.forEach((id) => cancelAnimationFrame(id));
    animations.clear();
  }

  function stopAnimation(scroller) {
    cancelAnimationFrame(animations.get(scroller));
    animations.delete(scroller);
  }

  function animateTo(scroller, target, duration, onDone) {
    cancelAnimationFrame(animations.get(scroller));
    wheelGoal.delete(scroller);

    const start    = scroller.scrollTop;
    const distance = target - start;
    let startTime  = null;

    function frame(now) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      // easeInOutQuad
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      scroller.scrollTop = start + distance * ease;

      if (progress < 1) {
        animations.set(scroller, requestAnimationFrame(frame));
      } else {
        animations.delete(scroller);
        if (onDone) onDone();
      }
    }
    animations.set(scroller, requestAnimationFrame(frame));
  }

  // elements의 상단을 scroller의 scrollTop 값으로 변환 (중복 제거, 오름차순)
  function positionsIn(scroller, elements) {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const max  = scroller.scrollHeight - scroller.clientHeight;
    const tops = elements.map((el) => Math.min(Math.round(el.getBoundingClientRect().top - base), max));
    return [...new Set(tops)].sort((a, b) => a - b);
  }

  // current에서 direction(1: 아래, -1: 위) 방향의 다음 지점. 없으면 null
  function nextPoint(points, current, direction) {
    const found = direction > 0
      ? points.find((p) => p > current + 2)
      : [...points].reverse().find((p) => p < current - 2);
    return found ?? null;
  }

  function nearestPoint(points, current) {
    return points.reduce((best, p) => (Math.abs(p - current) < Math.abs(best - current) ? p : best));
  }


  // ─────────────────────────────────────────────
  // 4. 패널 전환: 끝까지 본 패널은 그 위치에 고정되고, 다음 패널이 아래에서 올라와 덮는다
  // ─────────────────────────────────────────────
  // 패널(top-panel, 카테고리)은 CSS에서 박스 안 sticky. 첫 자리는 show-window 자리(spacer)로, 실제 show-window는
  // 박스 밖에 늘 그대로 있다. 박스(스크린 최상단 ~ 주소창 뒤까지, 높이 H)보다 긴 패널은 (H - 패널 높이)에서 고정되어
  // 끝까지 스크롤된 뒤에 멈춘다. 패널 i가 i-1을 덮는 구간은 박스 scrollTop [start - H, start].
  // 스크롤은 브라우저 기본 그대로(관성 포함)이고, 스냅 지점만 이 스크립트가 맡는다:
  // 다음 패널 내용 상단이 화면 한가운데(50%)를 지나면 스냅한다: 아래로 가다 지나면 끝까지 덮고(start),
  // 위로 가다 지나면 이전 패널을 다 드러낸다(start - H). 그 사이에서는 멈춘 자리에 머문다.
  // 스냅 지점을 넘으면 스크롤 세기와 상관없이 남은 관성을 끊고 꼭 그 지점에 멈춘다.
  const COVER_SNAP = 0.5;
  const panelEls   = [...pagination.children].filter((el) => el.matches(".show-window-spacer, .top-panel, .panels-wrapper"));
  let stack = [];   // [{ el, dimEl, start, label }]  start: 그 패널이 박스 맨 위에 닿는 박스 scrollTop

  // 박스 높이 H (화면 + 위아래 BLEED)
  function boxHeight() {
    return pagination.clientHeight;
  }

  function maxScroll() {
    return pagination.scrollHeight - pagination.clientHeight;
  }

  function layoutStack() {
    const h = boxHeight();
    let start = 0;
    stack = panelEls.map((el) => {
      const height = el.offsetHeight;
      const isSpacer = el.classList.contains("show-window-spacer");
      // 박스보다 긴 패널은 끝까지 본 뒤 고정
      if (!isSpacer) el.style.top = Math.min(0, h - height) + "px";
      const panel = { el, dimEl: isSpacer ? showWindow : el, start, label: el.querySelector(".panel-cover-label") };
      start += height;
      return panel;
    });
    updateCoverProgress();
  }

  // 패널마다 덮은 정도 (CSS --cover-progress: 0 = 화면 아래, 1 = 다 덮음). 그림자 진하기에 쓴다.
  // 덮이는 이전 패널은 같은 정도로 어두워지고(--cover-dim), 올라오는 동안에는 패널명 버블을 보인다.
  function updateCoverProgress() {
    const y = pagination.scrollTop;
    const h = boxHeight();
    stack.forEach(({ el, start, label }, i) => {
      if (i === 0) return;
      const progress = Math.min(Math.max((y - (start - h)) / h, 0), 1);
      el.style.setProperty("--cover-progress", progress.toFixed(3));
      if (stack[i - 1].dimEl) stack[i - 1].dimEl.style.setProperty("--cover-dim", progress.toFixed(3));
      if (label) label.classList.toggle("is-visible", progress > 0 && progress < 1);
    });
  }

  function panelTop(panel) {
    return Math.min(panel.start, maxScroll());
  }

  // from → to로 스크롤하는 동안 처음 넘은 스냅 지점의 목적지. 없으면 null.
  // 빠르게 튕겨 한 프레임에 스냅 지점과 패널 끝을 함께 지나쳐도 그 지점으로 되돌아온다.
  function crossedSnap(from, to) {
    const direction = Math.sign(to - from);
    if (!direction) return null;

    const h = boxHeight();
    const v = viewport();
    let found = null;
    for (let i = 1; i < stack.length; i++) {
      const end = panelTop(stack[i]);
      const at  = direction > 0 ? end - v * (1 - COVER_SNAP) : end - v * COVER_SNAP;
      const crossed = direction > 0 ? from < at && to >= at : from > at && to <= at;
      if (!crossed) continue;
      // 지나간 순서상 가장 먼저 만난 지점
      if (!found || (direction > 0 ? at < found.at : at > found.at)) {
        found = { at, target: direction > 0 ? end : end - h };
      }
    }
    return found ? found.target : null;
  }

  // 스냅: 남은 관성을 끊고(잠깐 스크롤을 막는다. iOS 관성도 overflow를 바꾸면 멈춘다) 목적지로 옮긴다.
  // 그동안의 휠·터치는 6·7번에서 막는다 (막힌 박스 대신 창이 스크롤되지 않게).
  //  - 터치: 박스를 막는 건 관성을 끊는 두 프레임만. iOS는 박스를 막는 동안 sticky 패널 층을 새로 그리는데,
  //    화면보다 긴 패널(카테고리)은 다 그리기 전까지 배경이 비어 이전 패널이 비친다.
  //  - 마우스 휠: 터치처럼 기본 스크롤이라, 두 프레임 막아 브라우저의 부드러운 스크롤을 끊는다.
  //  - 트랙패드: 트랙패드 스크롤은 처음부터 6번이 직접 한다(기본 스크롤을 막고 deltaY만큼 옮긴다). 브라우저는 한 번의 스크롤 중
  //    처음 이벤트를 막지 않으면 이어지는 이벤트(트랙패드 관성)를 막을 수 없게 보내, 스냅 중 남은 관성이 창(푸터)이나
  //    right-panel을 스크롤하거나 스냅 애니메이션과 싸워 화면이 떨린다. 직접 하면 스냅 중 이벤트를 버리기만 하면 되고
  //    박스를 막을(overflow) 필요도 없다. 스냅한 스크롤의 남은 관성은 스냅이 끝난 뒤에도 버리고(pageWheel.locked),
  //    새로 스와이프하면(6번 isFreshWheel) 바로 다시 스크롤된다.
  let snapping  = false;
  let lastInput = "trackpad";   // 스냅을 일으킨 입력: "trackpad"(직접 스크롤) | "native"(마우스 휠·터치, 기본 스크롤)

  function snapTo(target) {
    const y = pagination.scrollTop;
    snapping = true;
    buttonTarget = null;   // 9번: 버튼 이동은 끝났다
    if (lastInput === "trackpad") {
      pageWheel.locked = true;
    } else {
      pagination.style.overflowY = "hidden";
      pagination.scrollTop = y;
      requestAnimationFrame(() => requestAnimationFrame(() => { pagination.style.overflowY = ""; }));
    }
    animateTo(pagination, target, Math.min(250 + Math.abs(target - y) * 0.3, 600), () => { snapping = false; });
  }

  // 사용자 스크롤(기본 스크롤)을 지켜보다가 스냅 지점을 넘으면 스냅. 버튼 등 스크립트 이동 중에는 보지 않는다.
  let lastBoxY = 0;

  function watchSnap() {
    const y = pagination.scrollTop;
    if (!snapping && (!animations.has(pagination) || wheelGoal.has(pagination))) {
      const target = crossedSnap(lastBoxY, y);
      if (target !== null) snapTo(target);
    }
    lastBoxY = y;
  }

  // 푸터: 박스 끝에서 더 내려가면 문서를 끝까지 내려 푸터를 보여 주고,
  // 푸터가 보이는 상태에서 위로 가면 먼저 문서를 BLEED 위치로 되돌린다.
  function footerShown() {
    return pageScroller.scrollTop > BLEED + 1;
  }

  function pageMax() {
    return pageScroller.scrollHeight - pageScroller.clientHeight;
  }

  function atPaginationEnd() {
    return pagination.scrollTop >= maxScroll() - 1;
  }

  // 푸터는 이 두 함수로만 열고 닫는다. 그 밖에 창이 내려가면(패널 스냅 중 박스를 막은 사이 관성이 창으로 넘어간 경우 등)
  // 아래 창 스크롤 리스너가 BLEED로 되돌린다.
  let footerOpen = false;

  function showFooter() {
    footerOpen = true;
    animateTo(pageScroller, pageMax(), 450);
  }

  function hideFooter() {
    footerOpen = false;
    animateTo(pageScroller, BLEED, 450);
  }

  // target에서 박스까지 올라가며 direction 방향으로 더 스크롤할 수 있는 요소(right-panel 등)가 있는지
  function canScrollInside(target, direction) {
    for (let el = target; el && el !== pagination && el instanceof Element; el = el.parentElement) {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
        if (direction > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1) return true;
      }
    }
    return false;
  }

  layoutStack();
  pagination.addEventListener("scroll", () => {
    watchSnap();
    updateCoverProgress();
  }, { passive: true });

  // 창은 BLEED 아래로 올라가지 않고(푸터에서 손가락으로 끌어올릴 때 등), 푸터를 열지 않았으면 BLEED 밑으로도 내려가지 않는다
  window.addEventListener("scroll", () => {
    if (animations.has(pageScroller)) return;
    const y = pageScroller.scrollTop;
    if (y < BLEED - 1 || (!footerOpen && y > BLEED + 1)) pageScroller.scrollTop = BLEED;
  }, { passive: true });
  // 화면 높이가 바뀌면(회전, iOS 툴바 변화) 박스 크기·패널 위치를 다시 맞춘다
  function relayout() {
    sizeBox();
    layoutStack();
    if (!footerShown()) window.scrollTo(0, BLEED);
  }

  window.addEventListener("resize", relayout);
  // 이미지 로드, Load more 등으로 패널 높이가 바뀌면 다시 계산
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(layoutStack);
    panelEls.forEach((el) => observer.observe(el));
  }


  // ─────────────────────────────────────────────
  // 5. 데스크톱 배치: right-panel 안 스크롤
  // ─────────────────────────────────────────────
  // right-panel은 브라우저 기본 스크롤. 목록 끝(시작)에서 더 스크롤하면 박스로 이어져 4번의 패널 전환으로 넘어간다.

  // 보이는 항목만 (Load more 전에 숨겨 둔 항목 제외)
  function itemPoints(right) {
    const items = [...right.querySelectorAll(".post-item")].filter((li) => li.getClientRects().length > 0);
    return positionsIn(right, items);
  }

  function itemTarget(right, direction) {
    const top = nextPoint(itemPoints(right), right.scrollTop, direction);
    return top === null ? null : { scroller: right, top, points: () => itemPoints(right) };
  }

  // ── (사용 안 함) right-panel 항목 단위 스냅: 한 번의 스크롤 = 한 항목 이동 ──
  // 나중에 다시 쓸 수 있도록 남겨 둔다. 다시 쓰려면 주석을 풀고, 6번 휠·7번 터치에서 laneFor(target, direction)로
  // lane을 골라 handleWheel(e, lane)에 넘기고 기본 스크롤을 막아야 한다 (settledOn: 박스가 그 패널 시작에 멈춰 있는지).
  /*
  // 자유 스크롤 전환 기준: 이 이상이면 한 칸씩이 아니라 자유롭게 스크롤하고, 멈추면 가장 가까운 항목에 붙인다.
  const FREE_WHEEL_PEAK     = 150;   // 트랙패드·가속된 휠: 한 번의 스크롤에서 deltaY 최대값
  const FREE_WHEEL_REPEAT   = 4;     // 마우스 휠: 같은 크기(50 이상)로 연달아 굴린 횟수
  const FREE_TOUCH_DRAG     = 0.5;   // 터치: 끈 거리 / 스크롤 영역 높이
  const FREE_TOUCH_VELOCITY = 1.5;   // 터치: 손을 뗄 때 속도 (px/ms)
  const FREE_TOUCH_PROJECT  = 400;   // 터치: 손을 뗀 속도로 이어서 갈 거리 = 속도 × 이 시간(ms)

  // 휠 이벤트 하나가 '새 스크롤'의 시작인지 판단한다.
  // 마우스 휠은 한 칸마다 이벤트 간격이 벌어지지만, 트랙패드는 손을 뗀 뒤에도 관성 이벤트가
  // 1~2초 이어져서 다음 스와이프와 끊김 없이 붙는다. 그래서 '조용한 시간'만으로는 부족하다.
  // 트랙패드 한 번의 스와이프는 deltaY가 커졌다가(가속) 정점 이후 점점 작아진다(관성).
  // 아래 중 하나면 새 스크롤로 본다.
  //  - 200ms 이상 이벤트가 없었다 (마우스 휠 한 칸, 멈췄다가 다시 스와이프)
  //  - 방향이 바뀌었다
  //  - 관성 구간에 들어선 뒤 deltaY가 2번 연속 커져서 그 구간 최저값보다 4 이상, 1.5배 이상이 됐다
  //    (관성 중 새 스와이프). 관성 이벤트는 꾸준히 줄어들기만 하므로, 다시 커지면 스와이프 세기와
  //    상관없이 새 스와이프다. 이벤트가 합쳐져 값이 한 번 튀는 경우는 연속 증가 조건으로 거른다.
  //    관성 구간: 3번 연속 늘지 않고(값이 작으면 같은 값이 이어진다) 정점의 70% 아래.
  //    가속 중의 일시적인 감소는 관성으로 보지 않는다.
  let lastWheelTime = 0;
  let lastWheelAbs  = 0;
  let lastWheelDir  = 0;
  let wheelPeak     = 0;
  let wheelDeclines = 0;
  let wheelInTail   = false;
  let wheelValley   = 0;     // 관성 구간의 최저값
  let wheelRises    = 0;     // 연속 증가 횟수

  function isNewWheelIntent(e) {
    const now = performance.now();
    const abs = Math.abs(e.deltaY);
    const dir = Math.sign(e.deltaY);

    wheelRises = abs > lastWheelAbs ? wheelRises + 1 : 0;

    const fresh = now - lastWheelTime > 200
      || dir !== lastWheelDir
      || (wheelInTail && wheelRises >= 2 && abs >= wheelValley + 4 && abs >= wheelValley * 1.5);

    if (fresh) {
      wheelPeak     = abs;
      wheelDeclines = 0;
      wheelRises    = 0;
      wheelInTail   = false;
    } else {
      wheelPeak     = Math.max(wheelPeak, abs);
      wheelDeclines = abs <= lastWheelAbs ? wheelDeclines + 1 : 0;
      if (wheelInTail) {
        wheelValley = Math.min(wheelValley, abs);
      } else if (wheelDeclines >= 3 && abs < wheelPeak * 0.7) {
        wheelInTail = true;
        wheelValley = abs;
      }
    }

    lastWheelTime = now;
    lastWheelAbs  = abs;
    lastWheelDir  = dir;
    return fresh;
  }

  // lane = { scroller: right-panel, points(): 붙을 위치들, target(direction): { scroller, top } | null }
  // 이동 중에 들어온 새 스크롤은 기억했다가(같은 방향 최대 3개) 이동이 끝나면 하나씩 이어서 실행한다.
  // 방향이 바뀌면 새 방향으로 다시 센다.
  let pendingWheel = null;   // { lane, direction, count }

  function queueWheel(lane, direction) {
    if (pendingWheel && pendingWheel.lane === lane && pendingWheel.direction === direction) {
      pendingWheel.count = Math.min(pendingWheel.count + 1, 3);
    } else {
      pendingWheel = { lane, direction, count: 1 };
    }
  }

  function wheelStep(lane, direction) {
    const target = lane.target(direction);
    if (!target) {
      pendingWheel = null;
      return;
    }

    animateTo(target.scroller, target.top, 450, () => {
      const next = pendingWheel;
      if (!next) return;
      next.count -= 1;
      if (next.count === 0) pendingWheel = null;
      wheelStep(next.lane, next.direction);
    });
  }

  // 휠 자유 스크롤: 한 번의 스크롤(제스처)이 FREE_WHEEL_PEAK 이상으로 세거나, 마우스 휠을 같은 크기로
  // FREE_WHEEL_REPEAT번 연달아 굴리면 그 제스처는 한 칸 이동을 멈추고 deltaY만큼 직접 스크롤한다.
  // 전환 시점에는 제스처를 시작한 위치 + 지금까지 굴린 양으로 옮겨, 기본 스크롤처럼 입력이 빠짐없이 반영되게 한다.
  // 휠 이벤트가 150ms 멈추면 가장 가까운 지점에 붙인다(제자리면 적어도 한 칸).
  let wheelGesture = null;   // { lane, origin, sum, peak, repeat, lastAbs, stepped, free }
  let settleTimer  = null;

  function freeWheel(lane, deltaY) {
    const scroller = lane.scroller;
    scroller.scrollTop += deltaY;

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const g = wheelGesture;
      settleTimer  = null;
      wheelGesture = null;

      const points = lane.points();
      let destination = nearestPoint(points, scroller.scrollTop);
      if (g && Math.abs(destination - g.origin) < 2) {
        destination = nextPoint(points, g.origin, Math.sign(g.sum)) ?? destination;
      }
      // 붙는 동안 들어온 새 스크롤이 있으면 이어서 실행
      animateTo(scroller, destination, 300, () => {
        const next = pendingWheel;
        pendingWheel = null;
        if (next) wheelStep(next.lane, next.direction);
      });
    }, 150);
  }

  function handleWheel(e, lane) {
    const direction = Math.sign(e.deltaY);
    const abs       = Math.abs(e.deltaY);
    const fresh     = isNewWheelIntent(e);

    // 자유 스크롤 중이면 멈출 때까지 계속 직접 스크롤
    if (wheelGesture && wheelGesture.free && wheelGesture.lane === lane) {
      wheelGesture.sum += e.deltaY;
      freeWheel(lane, e.deltaY);
      return;
    }

    if (fresh) {
      wheelGesture = { lane, origin: lane.scroller.scrollTop, sum: e.deltaY, peak: abs, repeat: 1, lastAbs: abs, stepped: false, free: false };
    } else if (wheelGesture && wheelGesture.lane === lane) {
      const g = wheelGesture;
      g.sum    += e.deltaY;
      g.peak    = Math.max(g.peak, abs);
      g.repeat  = abs >= 50 && abs === g.lastAbs ? g.repeat + 1 : 1;
      g.lastAbs = abs;

      // 세거나 길게 굴리면 자유 스크롤로 전환 (진행 중인 한 칸 이동은 멈추고 시작 위치 + 굴린 양에서 이어간다)
      if (g.stepped && (g.peak >= FREE_WHEEL_PEAK || g.repeat >= FREE_WHEEL_REPEAT)) {
        g.free = true;
        pendingWheel = null;
        stopAnimation(lane.scroller);
        lane.scroller.scrollTop = g.origin;
        freeWheel(lane, g.sum);
        return;
      }
    }

    // 같은 스크롤의 이어지는 이벤트(관성 포함)는 무시
    if (!fresh) return;

    if (animations.has(lane.scroller)) {
      queueWheel(lane, direction);
      wheelGesture.stepped = true;
      return;
    }

    pendingWheel = null;
    wheelStep(lane, direction);
    wheelGesture.stepped = true;
  }

  const lanes = new Map();   // panels-wrapper → lane
  document.querySelectorAll(".panels-wrapper").forEach((wrapper) => {
    const right = wrapper.querySelector(".right-panel");
    if (!right) return;
    lanes.set(wrapper, {
      scroller: right,
      points:   () => itemPoints(right),
      target:   (direction) => itemTarget(right, direction),
    });
  });

  // 이 휠·터치를 right-panel 항목 이동이 받아야 하면 그 lane, 아니면 null
  function laneFor(target, direction) {
    if (palmQuery.matches) return null;
    const wrapper = target.closest && target.closest(".panels-wrapper");
    const lane    = wrapper && lanes.get(wrapper);
    if (!lane || !settledOn(wrapper)) return null;

    // 진행 중인 항목 이동·자유 스크롤은 lane이 계속 받는다
    if (animations.has(lane.scroller) || (wheelGesture && wheelGesture.lane === lane && wheelGesture.free)) return lane;
    return lane.target(direction) ? lane : null;
  }

  // 터치 제스처 한 번 = 한 항목 이동 (iPad 등 데스크톱 배치의 터치 기기).
  // 손가락을 따라 움직이다가 놓으면 다음 항목으로 가거나(40px 이상 또는 빠르게 튕김) 제자리로 돌아온다.
  // 길게 끌거나(FREE_TOUCH_DRAG) 세게 튕기면(FREE_TOUCH_VELOCITY) 자유 스크롤: 손을 뗀 속도로 이어서
  // 간 위치에서 가장 가까운 항목에 붙는다.
  // iOS는 첫 touchmove에서 스크롤 주체를 결정하므로 제어 여부는 제스처 시작 때 한 번만 정한다.
  function bindTouchStep(area, resolveTarget) {
    let gesture = null;

    area.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) {
        gesture = null;
        return;
      }
      const t = e.touches[0];
      gesture = { x: t.clientX, y: t.clientY, lastY: t.clientY, lastTime: e.timeStamp, velocity: 0, decided: false, target: null };
    }, { passive: true });

    area.addEventListener("touchmove", function (e) {
      if (!gesture || e.touches.length !== 1) return;

      const t      = e.touches[0];
      const deltaX = t.clientX - gesture.x;
      const deltaY = gesture.y - t.clientY;   // 양수: 아래로 스크롤

      if (!gesture.decided) {
        if (deltaY === 0) return;
        gesture.decided = true;

        const target = Math.abs(deltaX) > Math.abs(deltaY) ? null : resolveTarget(Math.sign(deltaY));
        if (!target) {
          gesture = null;   // 4번 패널 전환에 맡김
          return;
        }
        stopAnimations();
        gesture.target = target;
        gesture.origin = target.scroller.scrollTop;
      }

      e.preventDefault();

      const { scroller, top, points } = gesture.target;
      const max  = scroller.scrollHeight - scroller.clientHeight;
      const low  = points ? 0 : Math.min(gesture.origin, top);
      const high = points ? max : Math.max(gesture.origin, top);
      scroller.scrollTop = Math.max(low, Math.min(high, gesture.origin + deltaY));

      const dt = Math.max(e.timeStamp - gesture.lastTime, 1);
      gesture.velocity = 0.8 * ((gesture.lastY - t.clientY) / dt) + 0.2 * gesture.velocity;
      gesture.lastY    = t.clientY;
      gesture.lastTime = e.timeStamp;
    }, { passive: false });

    function endTouch(e) {
      if (gesture && gesture.target) {
        const { scroller, top, points } = gesture.target;
        const direction = Math.sign(top - gesture.origin);
        const moved     = scroller.scrollTop - gesture.origin;
        const velocity  = e.timeStamp - gesture.lastTime < 100 ? gesture.velocity : 0;
        const flicked   = Math.sign(velocity) === direction && Math.abs(velocity) > 0.3;
        const free      = Math.abs(moved) > scroller.clientHeight * FREE_TOUCH_DRAG
          || Math.abs(velocity) > FREE_TOUCH_VELOCITY;

        let destination;
        if (free) {
          destination = nearestPoint(points(), scroller.scrollTop + velocity * FREE_TOUCH_PROJECT);
          // 자유 스크롤인데 제자리로 돌아오게 되면 적어도 다음 지점까지는 간다
          if (Math.abs(destination - gesture.origin) < 2) destination = top;
        } else {
          destination = Math.abs(moved) > 40 || flicked ? top : gesture.origin;
        }

        const distance = Math.abs(destination - scroller.scrollTop);
        animateTo(scroller, destination, Math.min(350 + distance * 0.15, 900));
      }
      gesture = null;
    }

    area.addEventListener("touchend", endTouch, { passive: true });
    area.addEventListener("touchcancel", endTouch, { passive: true });
  }

  lanes.forEach((lane, wrapper) => {
    bindTouchStep(wrapper, (direction) => (laneFor(wrapper, direction) ? lane.target(direction) : null));
  });
  */


  // ─────────────────────────────────────────────
  // 6. 휠: 직접 스크롤. 스냅 중·직후의 남은 관성은 버리고, left-panel·푸터 경계는 따로 처리한다
  // ─────────────────────────────────────────────
  const pageWheel = {
    time: 0, direction: 0, locked: false,
    lastAbs: 0, peak: 0, declines: 0, rises: 0, inTail: false, valley: 0,
  };

  // 이 휠 이벤트가 새 스크롤(스와이프)의 시작인지.
  // 트랙패드는 손을 뗀 뒤에도 관성 이벤트가 1~2초 이어지고, 그사이 다시 스와이프하면 끊김 없이 붙는다.
  // 그래서 이벤트 간격만으로는 부족하고, 한 번의 스와이프는 deltaY가 커졌다가(가속) 정점 이후 줄어든다(관성)는 점을 쓴다.
  // 아래 중 하나면 새 스크롤로 본다.
  //  - 200ms 이상 이벤트가 없었다 (마우스 휠 한 칸, 멈췄다가 다시 스와이프)
  //  - 방향이 바뀌었다
  //  - 관성 구간에서 deltaY가 2번 연속 커져 그 구간 최저값보다 4 이상, 1.5배 이상이 됐다 (관성 중 새 스와이프).
  //    관성 구간: 3번 연속 늘지 않고 정점의 70% 아래.
  function isFreshWheel(now, direction, abs) {
    const w = pageWheel;
    w.rises = abs > w.lastAbs ? w.rises + 1 : 0;

    const fresh = now - w.time > 200
      || direction !== w.direction
      || (w.inTail && w.rises >= 2 && abs >= w.valley + 4 && abs >= w.valley * 1.5);

    if (fresh) {
      w.peak     = abs;
      w.declines = 0;
      w.rises    = 0;
      w.inTail   = false;
    } else {
      w.peak     = Math.max(w.peak, abs);
      w.declines = abs <= w.lastAbs ? w.declines + 1 : 0;
      if (w.inTail) {
        w.valley = Math.min(w.valley, abs);
      } else if (w.declines >= 3 && abs < w.peak * 0.7) {
        w.inTail = true;
        w.valley = abs;
      }
    }

    w.time      = now;
    w.direction = direction;
    w.lastAbs   = abs;
    return fresh;
  }

  function wheelDelta(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * viewport();
    return e.deltaY;
  }

  // PC 배치: 카테고리 패널에 멈춰 있을 때 left-panel 위에서 굴리면, right-panel이 그 방향 끝에 닿을 때까지
  // right-panel을 먼저 스크롤한다 (끝에 닿은 뒤에야 다음·이전 패널로 넘어간다). 해당하면 그 right-panel
  function rightPanelFirst(target, direction) {
    if (palmQuery.matches || !target.closest || !target.closest(".left-panel")) return null;
    const wrapper = target.closest(".panels-wrapper");
    const panel   = stack.find((p) => p.el === wrapper);
    const right   = wrapper && wrapper.querySelector(".right-panel");
    if (!panel || !right || Math.abs(pagination.scrollTop - panelTop(panel)) >= 1) return null;

    const max = right.scrollHeight - right.clientHeight;
    return (direction > 0 ? right.scrollTop < max - 1 : right.scrollTop > 1) ? right : null;
  }

  // 패널이 박스 맨 위에 다 올라와 멈춰 있는지 (올라오는 중·덮이는 중이 아닌지)
  function settledPanel(wrapper) {
    const panel = stack.find((p) => p.el === wrapper);
    return !!panel && Math.abs(pagination.scrollTop - panelTop(panel)) < 1;
  }

  // 휠이 스크롤할 요소: left-panel 규칙(rightPanelFirst) → 커서 아래 스크롤 영역(right-panel 등) → 박스.
  // 그 방향으로 더 갈 곳이 없으면(박스 끝) null
  function wheelScroller(target, direction) {
    const right = rightPanelFirst(target, direction);
    if (right) return right;
    // 박스 밖(헤더·버튼 등)에서 굴려도 문서가 아니라 박스를 스크롤한다
    for (let el = target; el && el !== pagination && el !== document.body && el instanceof Element; el = el.parentElement) {
      // 올라오는 중인 패널의 right-panel은 건너뛴다: 패널 전환을 끝까지 이어 가고, 다 올라온 뒤에 스크롤된다
      if (el.classList.contains("right-panel") && !settledPanel(el.closest(".panels-wrapper"))) continue;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
        && (direction > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1)) return el;
    }
    if (direction > 0) return atPaginationEnd() ? null : pagination;
    return pagination.scrollTop > 0 ? pagination : null;
  }

  // 트랙패드는 deltaY만큼 그대로 옮기고(OS가 준 가속·관성 그대로), 마우스 휠 한 칸(smooth)은 기본 스크롤처럼
  // 짧게 부드럽게 옮긴다. 부드럽게 옮기는 중에도 4번 스냅 감시는 계속한다 (wheelGoal에 있으면 휠이 움직이는 중).
  function wheelScrollBy(scroller, delta, smooth = false) {
    if (!smooth) {
      if (animations.has(scroller)) stopAnimation(scroller);
      scroller.scrollTop += delta;
      return;
    }
    const max  = scroller.scrollHeight - scroller.clientHeight;
    const from = wheelGoal.has(scroller) ? wheelGoal.get(scroller) : scroller.scrollTop;
    const goal = Math.max(0, Math.min(max, from + delta));
    animateTo(scroller, goal, 160, () => wheelGoal.delete(scroller));
    wheelGoal.set(scroller, goal);
  }

  // 마우스 휠인지 (트랙패드가 아니면). 마우스 휠은 브라우저 기본 스크롤(부드러운 스크롤·가속 등 OS 설정)을 그대로 쓴다.
  //  - Firefox 마우스: deltaMode가 줄·페이지 단위
  //  - Chrome·Safari 마우스: 옛 wheelDeltaY가 한 칸 120의 배수. 트랙패드는 작은 값이 이어진다 (wheelDeltaY = -3 × deltaY)
  function isMouseWheel(e) {
    if (e.deltaMode !== 0) return true;
    const legacy = e.wheelDeltaY;
    return typeof legacy === "number" && legacy !== 0 && legacy % 120 === 0 && legacy !== -3 * e.deltaY;
  }

  // 마우스 휠: 기본 스크롤. 스냅 중, left-panel 규칙, 올라오는 패널의 right-panel, 푸터 경계만 직접 처리한다.
  // 마우스 휠은 한 칸마다 막을 수 있는(cancelable) 이벤트라 트랙패드 같은 문제가 없다.
  function handleMouseWheel(e, direction) {
    lastInput = "native";
    if (snapping || animations.has(pageScroller)) {
      e.preventDefault();
      return;
    }

    if (footerShown()) {
      if (direction < 0) {
        e.preventDefault();
        hideFooter();
      }
      return;   // 아래로는 기본 스크롤 (푸터가 화면보다 길 때)
    }

    // left-panel 위 → right-panel, 올라오는 패널의 right-panel 위 → 박스: 기본 스크롤과 다른 요소를 움직이므로 직접
    const scroller = wheelScroller(e.target, direction);
    const native   = scroller && scroller === nativeScroller(e.target, direction);
    if (scroller && !native) {
      e.preventDefault();
      wheelScrollBy(scroller, wheelDelta(e), true);
      return;
    }

    // 박스 끝에서 아래로 굴리면 푸터로
    if (!scroller && direction > 0) {
      e.preventDefault();
      showFooter();
    }
  }

  // 기본 스크롤이 움직일 요소: 커서 아래에서 그 방향으로 스크롤할 수 있는 가장 가까운 요소 (없으면 박스)
  function nativeScroller(target, direction) {
    for (let el = target; el && el !== pagination && el !== document.body && el instanceof Element; el = el.parentElement) {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
        && (direction > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1)) return el;
    }
    return pagination;
  }

  // 트랙패드는 처음부터 끝까지 직접 스크롤한다 (기본 스크롤을 쓰지 않는 이유는 4번 snapTo 주석)
  window.addEventListener("wheel", function (e) {
    // 가로 스크롤과 핀치 확대(ctrlKey)는 브라우저에 맡긴다. top-panel 목록 가로 변환은 2번이 먼저 막는다.
    if (e.defaultPrevented || e.ctrlKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const direction = Math.sign(e.deltaY);
    const fresh     = isFreshWheel(performance.now(), direction, Math.abs(e.deltaY));
    if (isMouseWheel(e)) {
      handleMouseWheel(e, direction);
      return;
    }

    e.preventDefault();
    lastInput = "trackpad";
    if (fresh) pageWheel.locked = false;

    // 스냅 중, 그리고 스냅한 스크롤의 남은 이벤트(트랙패드 관성)는 버린다 → 스냅 지점에 꼭 멈춘다.
    // 스냅 중에 새로 시작한 스와이프는 잠그지 않아, 스냅이 끝나면 이어지는 이벤트로 바로 스크롤된다.
    if (snapping || pageWheel.locked || animations.has(pageScroller)) return;

    if (footerShown()) {
      if (direction < 0) {
        pageWheel.locked = true;
        hideFooter();
      } else {
        pageScroller.scrollTop = Math.min(pageMax(), pageScroller.scrollTop + wheelDelta(e));   // 푸터가 화면보다 길 때
      }
      return;
    }

    const scroller = wheelScroller(e.target, direction);
    if (scroller) {
      wheelScrollBy(scroller, wheelDelta(e));
      return;
    }

    // 박스 끝에서 새로 아래로 굴리면 푸터로 (끝에 닿은 스크롤의 남은 관성으로는 넘어가지 않는다)
    if (direction > 0 && fresh) {
      pageWheel.locked = true;
      showFooter();
    }
  }, { passive: false });


  // ─────────────────────────────────────────────
  // 7. 터치: 기본 스크롤(손가락 따라가기·관성 모두 브라우저). 스냅 중, 푸터 경계, left-panel만 따로 처리한다
  // ─────────────────────────────────────────────
  let touch = null;   // { x, y, decided, blocked, right, lastY, lastTime, velocity }
  let glidingRight = null;

  // left-panel을 끈 제스처는 right-panel을 대신 스크롤한다 (6번 휠의 rightPanelFirst와 같은 규칙).
  // 브라우저 기본 스크롤이 아니므로 손을 뗀 뒤의 관성도 직접 이어 간다 (iOS와 비슷한 감속).
  function dragRight(t, time) {
    const dy = touch.lastY - t.clientY;
    const dt = Math.max(time - touch.lastTime, 1);
    touch.right.scrollTop += dy;
    touch.velocity = 0.8 * (dy / dt) + 0.2 * touch.velocity;
    touch.lastY    = t.clientY;
    touch.lastTime = time;
  }

  function glideRight(right, velocity) {
    const max = right.scrollHeight - right.clientHeight;
    let pos  = right.scrollTop;   // scrollTop은 정수로 반올림될 수 있어 위치는 따로 센다
    let last = null;
    glidingRight = right;
    function frame(now) {
      if (last !== null) {
        const dt = now - last;
        pos = Math.max(0, Math.min(max, pos + velocity * dt));
        right.scrollTop = pos;
        velocity *= Math.pow(0.998, dt);
        // 끝에 닿거나 충분히 느려지면 멈춘다
        if (Math.abs(velocity) < 0.02 || pos <= 0 || pos >= max) {
          animations.delete(right);
          glidingRight = null;
          return;
        }
      }
      last = now;
      animations.set(right, requestAnimationFrame(frame));
    }
    animations.set(right, requestAnimationFrame(frame));
  }

  document.addEventListener("touchstart", function (e) {
    lastInput = "native";
    // 미끄러지던 right-panel은 새로 닿으면 멈춘다
    if (glidingRight) {
      stopAnimation(glidingRight);
      glidingRight = null;
    }
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, decided: false, blocked: false, right: null } : null;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    // 스냅 중에는 손가락이 움직여도 아무것도 스크롤하지 않는다 (막힌 박스 대신 창이 끌려가지 않게)
    if (snapping || (touch && touch.blocked)) {
      e.preventDefault();
      return;
    }
    if (touch && touch.right && e.touches.length === 1) {
      e.preventDefault();
      dragRight(e.touches[0], e.timeStamp);
      return;
    }
    if (!touch || touch.decided || e.touches.length !== 1) return;

    const t      = e.touches[0];
    const deltaX = t.clientX - touch.x;
    const deltaY = touch.y - t.clientY;   // 양수: 아래로 스크롤
    if (deltaY === 0) return;
    touch.decided = true;
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;   // 가로 스크롤

    const direction = Math.sign(deltaY);
    const right = rightPanelFirst(e.target, direction);
    if (right) {
      e.preventDefault();
      Object.assign(touch, { right, lastY: touch.y, lastTime: e.timeStamp, velocity: 0 });
      dragRight(t, e.timeStamp);
      return;
    }

    if (footerShown() ? direction < 0 : direction > 0 && atPaginationEnd() && !canScrollInside(e.target, 1)) {
      e.preventDefault();
      touch.blocked = true;
      if (direction < 0) hideFooter();
      else showFooter();
    }
  }, { passive: false });

  function endTouch(e) {
    if (touch && touch.right) {
      // 손을 떼기 직전 100ms 안에 움직였을 때만 관성
      const velocity = e.timeStamp - touch.lastTime < 100 ? touch.velocity : 0;
      if (Math.abs(velocity) > 0.05) glideRight(touch.right, velocity);
    }
    touch = null;
  }

  document.addEventListener("touchend", endTouch, { passive: true });
  document.addEventListener("touchcancel", endTouch, { passive: true });


  // ─────────────────────────────────────────────
  // 8. Load more: 목록 끝에 닿으면 버블이 천천히 나타나고, 누르면 다음 8개 포스트를 더 보여 준다
  // ─────────────────────────────────────────────
  const LOAD_MORE_COUNT = 8;

  // 끝에 닿았는지: 데스크톱 배치는 right-panel이 마지막 항목에 닿았을 때,
  // on-palm은 (목록 바로 아래에 있는) 버블이 화면에 다 들어왔을 때
  pagination.querySelectorAll(".load-more").forEach((more) => {
    const right  = more.parentElement;
    const list   = right.querySelector(".post-list");
    const bubble = more.querySelector(".load-more-bubble");
    let inView   = false;

    function update() {
      const atEnd = palmQuery.matches ? inView : itemTarget(right, 1) === null;
      more.classList.toggle("is-visible", atEnd);
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => { inView = entry.isIntersecting; });
        update();
      }, { threshold: 1 }).observe(more);
    } else {
      inView = true;
    }
    right.addEventListener("scroll", update, { passive: true });
    palmQuery.addEventListener("change", update);
    update();

    bubble.addEventListener("click", () => {
      const hidden = [...list.querySelectorAll(".post-item.is-more:not(.is-shown)")];
      hidden.slice(0, LOAD_MORE_COUNT).forEach((li) => li.classList.add("is-shown"));
      if (hidden.length <= LOAD_MORE_COUNT) more.remove();
      else update();
      layoutStack();
    });
  });


  // ─────────────────────────────────────────────
  // 9. 패널 내비게이션 버튼 (홈 전용): 이전/다음 패널(show-window, top-panel, 카테고리, 푸터)로 이동
  // ─────────────────────────────────────────────
  // 위로 이동하면(내비게이션 위 버튼, to-the-top) 머물던 패널과 그 위 모든 패널의 right-panel을 처음으로 되돌린다.
  // 머물던 패널: 화면에 보이는 패널 중 가장 아래 패널 (푸터가 보이면 마지막 패널)
  function currentPanelIndex() {
    if (footerShown()) return stack.length - 1;
    const bottom = pagination.scrollTop + BLEED + viewport() - 1;   // 화면 아래끝 (주소창 뒤 BLEED는 제외)
    let index = 0;
    stack.forEach((p, i) => {
      if (panelTop(p) < bottom) index = i;
    });
    return index;
  }

  function resetRightPanels(duration) {
    stack.slice(0, currentPanelIndex() + 1).forEach(({ el }) => {
      const right = el.querySelector(".right-panel");
      if (right && right.scrollTop > 0) animateTo(right, 0, duration);
    });
  }

  // to-the-top: 문서를 0까지 올리지 않고(BLEED 영역이 드러나므로) 박스를 맨 위로, 문서는 BLEED로 되돌린다.
  // click-to-top.html의 기본 동작보다 먼저(캡처 단계) 받아 대신 처리한다.
  // 버튼(to-the-top, 패널 내비게이션)으로 박스를 옮기는 중이면 그 목적지. 타이포 로고가 도착 전에 미리 사라지거나 나타난다.
  let buttonTarget = null;

  function buttonScroll(top, duration) {
    buttonTarget = top;
    animateTo(pagination, top, duration, () => { buttonTarget = null; });
  }

  const clickToTop = document.getElementById("click-to-top");
  if (clickToTop) {
    document.addEventListener("click", (e) => {
      if (!e.target.closest || !e.target.closest("#click-to-top")) return;
      e.stopPropagation();
      resetRightPanels(600);
      if (footerShown()) hideFooter();
      buttonScroll(0, Math.min(300 + pagination.scrollTop * 0.1, 900));
    }, { capture: true });
  }

  const nav = document.querySelector(".panel-nav");
  if (nav) {
    const prevButton = nav.querySelector(".panel-nav-prev");
    const nextButton = nav.querySelector(".panel-nav-next");

    function panelStops() {
      return [...new Set(stack.map((p) => Math.round(panelTop(p))))];
    }

    function goTo(top) {
      const distance = Math.abs(top - pagination.scrollTop);
      const duration = Math.min(300 + distance * 0.2, 900);
      buttonScroll(top, duration);
      return duration;
    }

    prevButton.addEventListener("click", () => {
      if (footerShown()) {
        resetRightPanels(450);
        hideFooter();
        return;
      }
      const stop = [...panelStops()].reverse().find((s) => s < pagination.scrollTop - 1);
      // 애니메이션은 다음 프레임부터 움직이므로 머물던 패널은 아직 이동 전 위치로 계산된다
      if (stop !== undefined) resetRightPanels(goTo(stop));
    });

    nextButton.addEventListener("click", () => {
      if (footerShown()) return;
      const stop = panelStops().find((s) => s > pagination.scrollTop + 1);
      if (stop !== undefined) goTo(stop);
      else showFooter();
    });

    function updateNav() {
      prevButton.disabled = pagination.scrollTop <= 1 && !footerShown();
      nextButton.disabled = footerShown() && pageScroller.scrollTop >= pageMax() - 1;
    }

    // show-window 타이포 로고 (show-window.html): show-window가 보이는 동안만 표시한다.
    //  - 사용자가 스크롤하는 동안은 버튼과 함께 감춘다 (로고 → 위 버튼 → 아래 버튼, 0.1초 간격. 간격은 CSS).
    //  - 멈춘 뒤 버튼이 다시 나타날 때 show-window가 아직 보이면 로고도 나타난다 (아래 버튼 → 위 버튼 → 로고).
    //    아래 패널에서 올라와 show-window에 멈춘 경우도 같다.
    //  - 버튼(패널 내비게이션·to-the-top)으로 오갈 때는 버튼이 그대로 있으므로 기다리지 않고 바로 사라지고 나타난다.
    // 다음 패널이 일부 올라와 있으면 로고는 그 뒤에 가려진다 (show-window 층 안에 있으므로).
    const logo = document.querySelector(".show-window-logo");

    function updateLogo(staggered) {
      if (!logo) return;
      // 버튼 이동 중이면 목적지 기준 (사용자가 스크롤해 버튼 이동이 끊긴 경우는 지금 위치)
      const y = buttonTarget !== null && animations.has(pagination) && !wheelGoal.has(pagination) ? buttonTarget : pagination.scrollTop;
      const inShowWindow = y < boxHeight() - 1 && !footerShown();
      const show = inShowWindow && !nav.classList.contains("is-scrolling");
      logo.classList.toggle("is-staggered", show && staggered === true);
      logo.classList.toggle("is-hidden", !show);
    }

    updateNav();
    updateLogo();
    pagination.addEventListener("scroll", () => { updateNav(); updateLogo(); }, { passive: true });
    window.addEventListener("scroll", () => { updateNav(); updateLogo(); }, { passive: true });

    // 사용자가 휠을 돌리거나 손가락으로 끄는 동안에만 감추고, 멈춘(손을 뗀) 뒤 1초가 지나면 다시 보인다.
    // 버튼을 눌러 자동으로 스크롤될 때(스크롤 이벤트만 생긴다)나 그냥 탭할 때는 그대로 둔다.
    let idleTimer = null;
    let touching  = false;

    function hideWhileScrolling() {
      buttonTarget = null;   // 사용자가 스크롤을 넘겨받았다
      nav.classList.add("is-scrolling");
      updateLogo();
      clearTimeout(idleTimer);
      if (!touching) {
        idleTimer = setTimeout(() => {
          nav.classList.remove("is-scrolling");
          updateLogo(true);
        }, 1000);
      }
    }

    document.addEventListener("wheel", hideWhileScrolling, { capture: true, passive: true });
    document.addEventListener("touchmove", () => {
      touching = true;
      hideWhileScrolling();
    }, { capture: true, passive: true });

    function endTouchScroll() {
      if (!touching) return;
      touching = false;
      hideWhileScrolling();   // 손을 뗀 때부터 1초
    }

    document.addEventListener("touchend", endTouchScroll, { capture: true, passive: true });
    document.addEventListener("touchcancel", endTouchScroll, { capture: true, passive: true });
  }

});

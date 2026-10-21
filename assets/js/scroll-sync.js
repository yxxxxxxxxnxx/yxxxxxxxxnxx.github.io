document.addEventListener("DOMContentLoaded", function () {
  const pagination = document.querySelector(".pagination");
  const topPanel   = document.querySelector(".top-panel");
  const postList   = topPanel?.querySelector(".post-list");

  if (!pagination || !topPanel || !postList) {
    console.warn("scroll-sync: required elements not found.");
    return;
  }

  const html         = document.documentElement;
  const pageScroller = document.scrollingElement || document.documentElement;
  const palmQuery    = window.matchMedia("(max-width: 600px)"); // $on-palm과 동일

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

  document.addEventListener("scroll", (e) => {
    const el = e.target === document ? pageScroller : e.target;
    if (!(el instanceof Element)) return;

    const y    = el.scrollTop;
    const last = lastScrollTops.has(el) ? lastScrollTops.get(el) : y;
    lastScrollTops.set(el, y);
    if (y === last) return;

    if (pagination.scrollTop === 0 && pageScroller.scrollTop === 0) setScrollStatus("top");
    else setScrollStatus(y > last ? "down" : "up");
  }, { capture: true, passive: true });


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

  function wheelDelta(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * pagination.clientHeight;
    return e.deltaY;
  }


  // ─────────────────────────────────────────────
  // 4. 패널 전환: 끝까지 본 패널은 그 위치에 고정되고, 다음 패널이 아래에서 올라와 덮는다
  // ─────────────────────────────────────────────
  // 패널(show-window, top-panel, 카테고리)은 CSS에서 sticky. 화면보다 긴 패널은 top을 (화면 높이 - 패널 높이)로
  // 두어 끝까지 스크롤된 뒤에 고정되게 한다. 패널 i가 i-1을 덮는 구간은 scrollTop [start - 화면 높이, start].
  // 구간 안에서는 자유 스크롤(멈춘 자리에 머문다). 아래로 가다 70%(70vh)를 넘으면 끝까지 덮고(start),
  // 위로 가다 70%를 넘게 내려가면 이전 패널을 다 드러낸다(start - 화면 높이).
  const COVER_SNAP = 0.7;
  const panelEls   = [...pagination.children].filter((el) => el.matches(".show-window, .top-panel, .panels-wrapper"));
  let stack = [];   // [{ el, start, label }]

  function viewport() {
    return pagination.clientHeight;
  }

  function maxScroll() {
    return pagination.scrollHeight - pagination.clientHeight;
  }

  function layoutStack() {
    const v = viewport();
    let start = 0;
    stack = panelEls.map((el) => {
      const height = el.offsetHeight;
      el.style.top = Math.min(0, v - height) + "px";
      const panel = { el, start, label: el.querySelector(".panel-cover-label") };
      start += height;
      return panel;
    });
    updateCoverProgress();
  }

  // 패널마다 덮은 정도 (CSS --cover-progress: 0 = 화면 아래, 1 = 다 덮음). 그림자 진하기에 쓴다.
  // 덮이는 이전 패널은 같은 정도로 어두워지고(--cover-dim), 올라오는 동안에는 패널명 버블을 보인다.
  function updateCoverProgress() {
    const y = pagination.scrollTop;
    const v = viewport();
    stack.forEach(({ el, start, label }, i) => {
      if (i === 0) return;
      const progress = Math.min(Math.max((y - (start - v)) / v, 0), 1);
      el.style.setProperty("--cover-progress", progress.toFixed(3));
      stack[i - 1].el.style.setProperty("--cover-dim", progress.toFixed(3));
      if (label) label.classList.toggle("is-visible", progress > 0 && progress < 1);
    });
  }

  function coverZoneAt(y) {
    const v = viewport();
    for (let i = 1; i < stack.length; i++) {
      const to = Math.min(stack[i].start, maxScroll());
      if (y > to - v + 0.5 && y < to - 0.5) return { from: to - v, to };
    }
    return null;
  }

  function snapTo(top) {
    const distance = Math.abs(top - pagination.scrollTop);
    animateTo(pagination, top, Math.min(250 + distance * 0.3, 600));
  }

  // direction으로 움직인 뒤 덮는 구간의 COVER_SNAP을 넘었으면 스냅한다. 스냅하면 true
  function checkCoverSnap(direction) {
    const y    = pagination.scrollTop;
    const zone = coverZoneAt(y);
    if (!zone) return false;

    const v = viewport();
    if (direction > 0 && y >= zone.from + v * COVER_SNAP) {
      snapTo(zone.to);
      return true;
    }
    if (direction < 0 && y <= zone.to - v * COVER_SNAP) {
      snapTo(zone.from);
      return true;
    }
    return false;
  }

  // pagination 자유 스크롤. 스냅하면 true
  function scrollPaginationBy(delta) {
    pagination.scrollTop = Math.max(0, Math.min(maxScroll(), pagination.scrollTop + delta));
    return checkCoverSnap(Math.sign(delta));
  }

  // 터치를 놓은 뒤 이어지는 관성 스크롤. pagination이면 도중에 COVER_SNAP을 넘을 때 스냅한다.
  let glideId = null;

  function stopGlide() {
    cancelAnimationFrame(glideId);
    glideId = null;
  }

  function glide(velocity, scroller = pagination) {   // px/ms
    stopGlide();
    let v    = velocity;
    let last = null;

    function frame(now) {
      if (last === null) last = now;
      const dt     = Math.min(now - last, 32);
      const before = scroller.scrollTop;
      last = now;

      if (scroller === pagination) {
        if (scrollPaginationBy(v * dt)) {
          glideId = null;
          return;
        }
      } else {
        scroller.scrollTop += v * dt;
      }
      v *= Math.pow(0.95, dt / 16);
      if (Math.abs(v) < 0.05 || scroller.scrollTop === before) {
        glideId = null;
        return;
      }
      glideId = requestAnimationFrame(frame);
    }
    glideId = requestAnimationFrame(frame);
  }

  // 푸터: pagination 끝에서 더 내려가면 페이지(창)를 끝까지 내려 푸터를 보여 주고,
  // 푸터가 보이는 상태에서 위로 가면 먼저 페이지를 맨 위로 되돌린다.
  function footerShown() {
    return pageScroller.scrollTop > 0;
  }

  function pageMax() {
    return pageScroller.scrollHeight - pageScroller.clientHeight;
  }

  function atPaginationEnd() {
    return pagination.scrollTop >= maxScroll() - 1;
  }

  function showFooter() {
    animateTo(pageScroller, pageMax(), 450);
  }

  function hideFooter() {
    animateTo(pageScroller, 0, 450);
  }

  // pagination이 el 패널 시작 위치에 멈춰 있는지
  function settledOn(el) {
    const panel = stack.find((p) => p.el === el);
    return !!panel && !footerShown() && Math.abs(pagination.scrollTop - Math.min(panel.start, maxScroll())) < 1;
  }

  layoutStack();
  pagination.addEventListener("scroll", updateCoverProgress, { passive: true });
  window.addEventListener("resize", layoutStack);
  // 이미지 로드, Load more 등으로 패널 높이가 바뀌면 다시 계산
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(layoutStack);
    panelEls.forEach((el) => observer.observe(el));
  }


  // ─────────────────────────────────────────────
  // 5. 데스크톱 배치: right-panel 안 스크롤
  // ─────────────────────────────────────────────
  // 카테고리 패널에 멈춰 있을 때 그 위의 휠·터치는 right-panel을 자유롭게 스크롤한다.
  // 목록 끝(시작)에서 더 스크롤하면 4번의 패널 전환으로 넘어간다.

  // 보이는 항목만 (Load more 전에 숨겨 둔 항목 제외)
  function itemPoints(right) {
    const items = [...right.querySelectorAll(".post-item")].filter((li) => li.getClientRects().length > 0);
    return positionsIn(right, items);
  }

  function itemTarget(right, direction) {
    const top = nextPoint(itemPoints(right), right.scrollTop, direction);
    return top === null ? null : { scroller: right, top, points: () => itemPoints(right) };
  }

  // direction 방향으로 더 스크롤할 수 있는 right-panel (그 카테고리 패널에 멈춰 있을 때만). 없으면 null
  function scrollableRight(target, direction) {
    if (palmQuery.matches) return null;
    const wrapper = target.closest && target.closest(".panels-wrapper");
    const right   = wrapper && wrapper.querySelector(".right-panel");
    if (!right || !settledOn(wrapper)) return null;

    const max = right.scrollHeight - right.clientHeight;
    return (direction > 0 ? right.scrollTop < max - 1 : right.scrollTop > 1) ? right : null;
  }

  // ── (사용 안 함) right-panel 항목 단위 스냅: 한 번의 스크롤 = 한 항목 이동 ──
  // 나중에 다시 쓸 수 있도록 남겨 둔다. 다시 쓰려면 주석을 풀고, 6번 휠과 7번 터치에서
  // scrollableRight 대신 laneFor(target, direction)로 lane을 골라 handleWheel(e, lane)에 넘기면 된다.
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
  // 6. 휠: right-panel 스크롤(5번) 또는 패널 전환(4번)
  // ─────────────────────────────────────────────
  // 패널 전환은 deltaY만큼 직접 스크롤한다. 스냅하거나 푸터로 넘어가면 같은 스크롤의 남은 이벤트(관성)는 버린다.
  const pageWheel = { time: 0, direction: 0, locked: false };
  let laneWheel   = { time: 0, direction: 0 };

  pagination.addEventListener("wheel", function (e) {
    if (e.defaultPrevented || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();

    const now       = performance.now();
    const direction = Math.sign(e.deltaY);

    const right = scrollableRight(e.target, direction);
    if (right) {
      laneWheel = { time: now, direction };
      right.scrollTop += wheelDelta(e);
      return;
    }
    // right-panel 끝에 닿은 스크롤의 남은 이벤트(관성)는 다음 패널로 넘기지 않는다
    if (now - laneWheel.time < 200 && direction === laneWheel.direction) {
      laneWheel.time = now;
      return;
    }

    const fresh = now - pageWheel.time > 200 || direction !== pageWheel.direction;
    pageWheel.time      = now;
    pageWheel.direction = direction;
    if (fresh) pageWheel.locked = false;
    if (pageWheel.locked || animations.has(pagination) || animations.has(pageScroller)) return;

    stopGlide();

    if (footerShown()) {
      if (direction < 0) {
        pageWheel.locked = true;
        hideFooter();
      }
      return;
    }
    if (direction > 0 && atPaginationEnd()) {
      pageWheel.locked = true;
      showFooter();
      return;
    }

    if (scrollPaginationBy(wheelDelta(e))) pageWheel.locked = true;
  }, { passive: false });

  // 푸터 위에서 위로 휠 → 페이지를 맨 위로 되돌려 pagination으로 복귀
  window.addEventListener("wheel", function (e) {
    if (e.defaultPrevented || e.deltaY >= 0 || !footerShown()) return;
    e.preventDefault();
    if (!animations.has(pageScroller)) hideFooter();
  }, { passive: false });


  // ─────────────────────────────────────────────
  // 7. 터치: 패널 전환 (손가락을 따라 자유 스크롤, 놓으면 관성. COVER_SNAP을 넘으면 스냅)
  // ─────────────────────────────────────────────
  // 데스크톱 배치에서 카테고리 패널에 멈춰 있고 right-panel을 더 스크롤할 수 있으면 right-panel을 움직인다.
  let touch = null;

  pagination.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) {
      touch = null;
      return;
    }
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, lastY: t.clientY, lastTime: e.timeStamp, velocity: 0, decided: false };
  }, { passive: true });

  pagination.addEventListener("touchmove", function (e) {
    if (!touch || e.touches.length !== 1) return;

    const t      = e.touches[0];
    const deltaX = t.clientX - touch.x;
    const deltaY = touch.y - t.clientY;   // 양수: 아래로 스크롤

    if (!touch.decided) {
      if (deltaY === 0) return;
      touch.decided = true;

      if (e.defaultPrevented || Math.abs(deltaX) > Math.abs(deltaY)) {
        touch = null;   // 가로 스크롤
        return;
      }

      const direction = Math.sign(deltaY);
      stopAnimations();
      stopGlide();

      const right = scrollableRight(e.target, direction);
      if (right) {
        touch.scroller = right;
        touch.origin   = right.scrollTop;
        e.preventDefault();
        return;
      }

      if (footerShown() || (direction > 0 && atPaginationEnd())) {
        e.preventDefault();
        if (direction < 0) hideFooter();
        else if (!footerShown()) showFooter();
        touch = null;
        return;
      }
      touch.scroller = pagination;
      touch.origin   = pagination.scrollTop;
    }

    e.preventDefault();
    const scroller = touch.scroller;
    const max      = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = Math.max(0, Math.min(max, touch.origin + deltaY));

    const dt = Math.max(e.timeStamp - touch.lastTime, 1);
    touch.velocity = 0.8 * ((touch.lastY - t.clientY) / dt) + 0.2 * touch.velocity;
    touch.lastY    = t.clientY;
    touch.lastTime = e.timeStamp;
  }, { passive: false });

  function endPaginationTouch(e) {
    const g = touch;
    touch = null;
    if (!g || !g.decided) return;

    const velocity = e.timeStamp - g.lastTime < 100 ? g.velocity : 0;
    if (g.scroller !== pagination) {
      if (Math.abs(velocity) > 0.05) glide(velocity, g.scroller);
      return;
    }

    const direction = Math.sign(velocity) || Math.sign(pagination.scrollTop - g.origin);
    if (checkCoverSnap(direction)) return;
    if (Math.abs(velocity) > 0.05) glide(velocity);
  }

  pagination.addEventListener("touchend", endPaginationTouch, { passive: true });
  pagination.addEventListener("touchcancel", endPaginationTouch, { passive: true });


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
    const bottom = pagination.scrollTop + viewport() - 1;
    let index = 0;
    stack.forEach((p, i) => {
      if (Math.min(p.start, maxScroll()) < bottom) index = i;
    });
    return index;
  }

  function resetRightPanels(duration) {
    stack.slice(0, currentPanelIndex() + 1).forEach(({ el }) => {
      const right = el.querySelector(".right-panel");
      if (right && right.scrollTop > 0) animateTo(right, 0, duration);
    });
  }

  const clickToTop = document.getElementById("click-to-top");
  if (clickToTop) clickToTop.addEventListener("click", () => resetRightPanels(600));

  const nav = document.querySelector(".panel-nav");
  if (nav) {
    const prevButton = nav.querySelector(".panel-nav-prev");
    const nextButton = nav.querySelector(".panel-nav-next");

    function panelStops() {
      const max = maxScroll();
      return [...new Set(stack.map((p) => Math.round(Math.min(p.start, max))))];
    }

    function goTo(top) {
      stopGlide();
      const distance = Math.abs(top - pagination.scrollTop);
      const duration = Math.min(300 + distance * 0.2, 900);
      animateTo(pagination, top, duration);
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
      nextButton.disabled = footerShown() ? pageScroller.scrollTop >= pageMax() - 1 : (atPaginationEnd() && pageMax() <= 0);
    }

    updateNav();
    pagination.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("scroll", updateNav, { passive: true });

    // 사용자가 휠을 돌리는 동안에만 감추고, 멈춘 뒤 1초가 지나면 다시 보인다.
    // 버튼을 눌러 자동으로 스크롤될 때(스크롤 이벤트만 생긴다)는 그대로 둔다.
    let idleTimer = null;
    document.addEventListener("wheel", () => {
      nav.classList.add("is-scrolling");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => nav.classList.remove("is-scrolling"), 1000);
    }, { capture: true, passive: true });
  }

});

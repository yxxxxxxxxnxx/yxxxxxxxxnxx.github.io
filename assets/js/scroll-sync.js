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
  // 3. 한 번의 스크롤 = 한 항목 이동 (공통 도구)
  // ─────────────────────────────────────────────
  const palmQuery = window.matchMedia("(max-width: 600px)"); // $on-palm과 동일

  // 자유 스크롤 전환 기준: 이 이상이면 한 칸씩이 아니라 자유롭게 스크롤하고, 멈추면 가장 가까운 항목에 붙인다.
  const FREE_WHEEL_PEAK     = 150;   // 트랙패드·가속된 휠: 한 번의 스크롤에서 deltaY 최대값
  const FREE_WHEEL_REPEAT   = 4;     // 마우스 휠: 같은 크기(50 이상)로 연달아 굴린 횟수
  const FREE_TOUCH_DRAG     = 0.5;   // 터치: 끈 거리 / 스크롤 영역 높이
  const FREE_TOUCH_VELOCITY = 1.5;   // 터치: 손을 뗄 때 속도 (px/ms)
  const FREE_TOUCH_PROJECT  = 400;   // 터치: 손을 뗀 속도로 이어서 갈 거리 = 속도 × 이 시간(ms)

  // CSS에서 scroll-snap-align을 줄 수 있는 요소들. 실제 스냅 여부는 계산된 스타일로 판단한다.
  const SNAP_CANDIDATES = ".top-panel, .panels-wrapper, .left-panel, .post-image-container";

  // elements의 상단을 scroller의 scrollTop 값으로 변환 (중복 제거, 오름차순)
  function positionsIn(scroller, elements) {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const max  = scroller.scrollHeight - scroller.clientHeight;
    const tops = elements.map((el) => Math.min(Math.round(el.getBoundingClientRect().top - base), max));
    return [...new Set(tops)].sort((a, b) => a - b);
  }

  function paginationPoints() {
    const snapped = [...pagination.querySelectorAll(SNAP_CANDIDATES)]
      .filter((el) => getComputedStyle(el).scrollSnapAlign !== "none");
    return positionsIn(pagination, snapped);
  }

  function itemPoints(right) {
    return positionsIn(right, [...right.querySelectorAll(".post-item")]);
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

  // 직접 제어하는 동안에는 CSS 스냅과 smooth 스크롤을 꺼서 프레임 단위 이동과 충돌하지 않게 한다
  function holdSnap(scroller) {
    scroller.style.scrollSnapType = "none";
    scroller.style.scrollBehavior = "auto";
  }

  function releaseSnap(scroller) {
    scroller.style.scrollSnapType = "";
    scroller.style.scrollBehavior = "";
  }

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
    holdSnap(scroller);

    const start    = scroller.scrollTop;
    const distance = target - start;
    let startTime  = null;

    function frame(now) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      scroller.scrollTop = start + distance * ease;

      if (progress < 1) {
        animations.set(scroller, requestAnimationFrame(frame));
      } else {
        animations.delete(scroller);
        releaseSnap(scroller);
        if (onDone) onDone();
      }
    }
    animations.set(scroller, requestAnimationFrame(frame));
  }

  // 데스크톱 배치: right-panel의 다음 항목, 목록 끝이면 pagination의 다음 지점(이전/다음 카테고리)
  // 데스크톱 배치에서 right-panel 끝(시작)을 넘어설 때 갈 이전/다음 카테고리
  function categoryTarget(direction) {
    const page = nextPoint(paginationPoints(), pagination.scrollTop, direction);
    return page === null ? null : { scroller: pagination, top: page };
  }

  function desktopTarget(right, direction) {
    const item = nextPoint(itemPoints(right), right.scrollTop, direction);
    if (item !== null) return { scroller: right, top: item, points: () => itemPoints(right), overflow: categoryTarget };

    return categoryTarget(direction);
  }

  // 터치 제스처 한 번 = 한 지점 이동.
  // 손가락을 따라 움직이다가 놓으면 목표 지점으로 가거나(40px 이상 또는 빠르게 튕김) 제자리로 돌아온다.
  // 길게 끌거나(FREE_TOUCH_DRAG) 세게 튕기면(FREE_TOUCH_VELOCITY) 자유 스크롤: 손을 뗀 속도로 이어서
  // 간 위치에서 가장 가까운 지점에 붙는다. target.points가 없으면(카테고리 이동) 한 칸만 움직인다.
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
          gesture = null;   // 기본 스크롤에 맡김
          return;
        }
        stopAnimations();
        holdSnap(target.scroller);
        gesture.target = target;
        gesture.origin = target.scroller.scrollTop;
      }

      e.preventDefault();

      // 자유 스크롤이 가능하면 손가락을 그대로 따라가고, 아니면 다음 지점까지만 움직인다
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
        const { scroller, top, points, overflow } = gesture.target;
        const direction = Math.sign(top - gesture.origin);
        const moved     = scroller.scrollTop - gesture.origin;
        const velocity  = e.timeStamp - gesture.lastTime < 100 ? gesture.velocity : 0;
        const flicked   = Math.sign(velocity) === direction && Math.abs(velocity) > 0.3;
        const free      = points && (Math.abs(moved) > scroller.clientHeight * FREE_TOUCH_DRAG
          || Math.abs(velocity) > FREE_TOUCH_VELOCITY);

        const projected = scroller.scrollTop + velocity * FREE_TOUCH_PROJECT;
        const allPoints = points ? points() : null;

        let destination;
        let crossTo = null;   // 목록 끝을 넘어서면 이어서 갈 이전/다음 카테고리
        if (free) {
          destination = nearestPoint(allPoints, projected);
          // 자유 스크롤인데 제자리로 돌아오게 되면 적어도 다음 지점까지는 간다
          if (Math.abs(destination - gesture.origin) < 2) destination = top;
          // 도착 위치가 마지막(첫) 항목을 화면 1/4 이상 넘어서면 그 항목까지 간 뒤 다음(이전) 카테고리로 넘어간다
          const first = allPoints[0];
          const last  = allPoints[allPoints.length - 1];
          const reach = scroller.clientHeight * 0.25;
          if (overflow && (projected > last + reach || projected < first - reach)) {
            const edge = projected > last ? 1 : -1;
            destination = edge > 0 ? last : first;
            crossTo = overflow(edge);
          }
        } else {
          destination = Math.abs(moved) > 40 || flicked ? top : gesture.origin;
        }

        const distance = Math.abs(destination - scroller.scrollTop);
        animateTo(scroller, destination, Math.min(350 + distance * 0.15, 900), () => {
          if (crossTo) animateTo(crossTo.scroller, crossTo.top, 450);
        });
      }
      gesture = null;
    }

    area.addEventListener("touchend", endTouch, { passive: true });
    area.addEventListener("touchcancel", endTouch, { passive: true });
  }


  // ─────────────────────────────────────────────
  // 3-1. 데스크톱 배치: Left/Right Panel 휠·터치 → Right Panel 항목 단위 이동
  // ─────────────────────────────────────────────
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

  // 휠로 한 칸씩 움직이는 대상을 lane으로 묶는다.
  //  - 데스크톱 배치: right-panel의 항목 (끝에 닿으면 pagination의 이전/다음 카테고리)
  //  - on-palm: pagination의 스냅 지점 (top-panel, 카테고리명, 포스트 이미지 상단)
  // lane = { scroller, points(): 붙을 위치들, target(direction): { scroller, top } | null,
  //          overflow(direction): 자유 스크롤이 끝(시작)을 넘을 때 갈 곳 (데스크톱 배치만) }

  // 이동 중에 들어온 새 스크롤은 기억했다가(같은 방향 최대 3개) 이동이 끝나면 하나씩 이어서 실행한다.
  // 방향이 바뀌면 새 방향으로 다시 센다. 카테고리가 바뀐 경우(lane 밖으로 이동)에는 버린다.
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
      return null;
    }

    animateTo(target.scroller, target.top, 450, () => {
      const next = pendingWheel;
      if (!next || target.scroller !== lane.scroller) {
        pendingWheel = null;
        return;
      }
      next.count -= 1;
      if (next.count === 0) pendingWheel = null;
      wheelStep(next.lane, next.direction);
    });
    return target.scroller;
  }

  // 휠 자유 스크롤: 한 번의 스크롤(제스처)이 FREE_WHEEL_PEAK 이상으로 세거나, 마우스 휠을 같은 크기로
  // FREE_WHEEL_REPEAT번 연달아 굴리면 그 제스처는 한 칸 이동을 멈추고 deltaY만큼 직접 스크롤한다.
  // 전환 시점에는 제스처를 시작한 위치 + 지금까지 굴린 양으로 옮겨, 기본 스크롤처럼 입력이 빠짐없이 반영되게 한다.
  // 휠 이벤트가 150ms 멈추면 가장 가까운 지점에 붙인다(제자리면 적어도 한 칸). 카테고리 이동 중에는 전환하지 않는다.
  let wheelGesture = null;   // { lane, origin, sum, peak, repeat, lastAbs, stepped, free, crossed }
  let settleTimer  = null;

  function freeWheel(lane, deltaY) {
    const scroller = lane.scroller;
    const max      = scroller.scrollHeight - scroller.clientHeight;
    const wanted   = scroller.scrollTop + deltaY;
    holdSnap(scroller);
    scroller.scrollTop = wanted;

    // 목록 끝(시작)에 닿고도 스크롤이 남으면 다음(이전) 카테고리로 한 번 넘어간다.
    // 같은 제스처의 남은 관성 이벤트는 무시해서 여러 카테고리를 건너뛰지 않게 한다.
    if (lane.overflow && (wanted > max + 1 || wanted < -1)) {
      const target = lane.overflow(Math.sign(deltaY));
      if (target) {
        clearTimeout(settleTimer);
        settleTimer  = null;
        pendingWheel = null;
        releaseSnap(scroller);
        if (wheelGesture) {
          wheelGesture.free    = false;
          wheelGesture.crossed = true;
        }
        animateTo(target.scroller, target.top, 450);
        return;
      }
    }

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
    if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const direction = Math.sign(e.deltaY);
    const abs       = Math.abs(e.deltaY);
    const fresh     = isNewWheelIntent(e);

    // 자유 스크롤로 카테고리를 넘어간 제스처의 남은 이벤트(관성)는 무시
    if (!fresh && wheelGesture && wheelGesture.crossed) {
      e.preventDefault();
      return;
    }

    // 자유 스크롤 중이면 멈출 때까지 계속 직접 스크롤
    if (wheelGesture && wheelGesture.free && wheelGesture.lane === lane) {
      e.preventDefault();
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
        e.preventDefault();
        holdSnap(lane.scroller);
        lane.scroller.scrollTop = g.origin;
        freeWheel(lane, g.sum);
        return;
      }
    }

    // 같은 스크롤의 이어지는 이벤트(관성 포함)는 무시
    if (!fresh) {
      e.preventDefault();
      return;
    }

    if (animations.size > 0) {
      e.preventDefault();
      queueWheel(lane, direction);
      wheelGesture.stepped = true;
      return;
    }

    // 마지막 지점이면 기본 스크롤(푸터)로
    pendingWheel = null;   // 터치 이동 중에 남은 예약 등은 버린다
    const scroller = wheelStep(lane, direction);
    if (scroller) {
      e.preventDefault();
      wheelGesture.stepped = scroller === lane.scroller;
    }
  }

  document.querySelectorAll(".panels-wrapper").forEach((wrapper) => {
    const right = wrapper.querySelector(".right-panel");
    if (!right) return;

    const lane = {
      scroller: right,
      points:   () => itemPoints(right),
      target:   (direction) => desktopTarget(right, direction),
      overflow: categoryTarget,
    };

    wrapper.addEventListener("wheel", function (e) {
      if (palmQuery.matches) return;   // on-palm은 pagination에서 처리
      handleWheel(e, lane);
    }, { passive: false });

    // iPad 등 데스크톱 배치의 터치 기기
    bindTouchStep(wrapper, (direction) => palmQuery.matches ? null : desktopTarget(right, direction));
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


  // ─────────────────────────────────────────────
  // 5. on-palm 전용: 휠·터치 한 번에 스냅 지점(top-panel, 카테고리명, 포스트 이미지 상단) 하나씩 이동
  // ─────────────────────────────────────────────
  function palmTarget(direction) {
    const top = nextPoint(paginationPoints(), pagination.scrollTop, direction);
    return top === null ? null : { scroller: pagination, top, points: paginationPoints };
  }

  const palmLane = { scroller: pagination, points: paginationPoints, target: palmTarget };

  pagination.addEventListener("wheel", function (e) {
    if (!palmQuery.matches) return;
    handleWheel(e, palmLane);
  }, { passive: false });

  bindTouchStep(pagination, (direction) => palmQuery.matches ? palmTarget(direction) : null);

});

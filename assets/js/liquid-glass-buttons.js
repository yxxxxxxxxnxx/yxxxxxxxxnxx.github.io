// to-the-top·패널 내비게이션 버튼에 리퀴드 글래스 (gentpan/liquidglass 엔진).
//  - Chrome·Edge: 버튼 뒤 화면을 실제로 굴절시킨다 (backdrop-filter: url(SVG 변위 맵)).
//  - Safari·Firefox: 약한 블러 유리로 대체한다. 값은 CSS의 %liquid-glass와 같다.
// 굴절이 켜진 버튼에는 .is-refracting을 붙여 CSS가 유리 색·하이라이트를 엷게 한다 (엔진이 테두리 반사를 직접 그린다).
import { createGlass, engine } from "./vendor/liquid-glass.js";

// Chrome 굴절 버튼(blur 2 + 가장자리 굴절)과 비슷한 투명도로 보이도록 약하게 흐린다
const FALLBACK = "blur(4px) saturate(160%)";

document.querySelectorAll("#click-to-top, .panel-nav").forEach((el) => {
  createGlass(el, {
    mode: "backdrop",
    fit: true,          // 버튼 크기를 따라간다 (반응형 크기 변화 포함)
    radius: 9999,       // 폭·높이의 절반으로 잘린다 → 늘 알약 모양
    refraction: 18,     // 가장자리에서 휘는 최대 거리 (CSS px)
    blur: 2,            // 살짝 서린 정도
    fallback: FALLBACK,
  });
  if (engine === "blink") el.classList.add("is-refracting");
});

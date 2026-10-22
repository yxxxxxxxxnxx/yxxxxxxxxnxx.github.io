#!/usr/bin/env bash
# 링크 미리보기(og:image)용 JPEG를 만든다: assets/og/<포스트 폴더>.jpg, assets/og/home.jpg
#  - 포스트: assets/att/<폴더>/banner.* → 긴 변 1200px, sRGB JPEG (HDR은 macOS가 SDR로 톤매핑)
#  - 홈: _data/show_window.yml의 첫 사진
# 이미 있는 파일은 건너뛴다 (다시 만들려면 지우고 실행). _plugins/seo-extras.rb가 이 파일을 og:image로 쓴다.
# 사용법: bash _tools/make-og-images.sh   (macOS sips 필요)
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=assets/og
SRGB="/System/Library/ColorSync/Profiles/sRGB Profile.icc"
mkdir -p "$OUT"

make() {   # make <원본> <결과>
  [ -f "$2" ] && return
  sips -s format jpeg -s formatOptions 75 -Z 1200 -m "$SRGB" "$1" --out "$2" >/dev/null
  echo "  ✓ $2 ($(( $(stat -f%z "$2") / 1024 ))KB)"
}

for banner in assets/att/*/banner.*; do
  make "$banner" "$OUT/$(basename "$(dirname "$banner")").jpg"
done

home=$(sed -n 's/^- file: *//p' _data/show_window.yml | head -1)
[ -n "$home" ] && make "assets/images/show-window/$home" "$OUT/home.jpg"
echo "완료"

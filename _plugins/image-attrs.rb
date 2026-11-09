# frozen_string_literal: true
#
# 포스트 본문 사진(<img src="/assets/...">)을 빌드할 때 손본다.
#  - loading="lazy" decoding="async": 화면에 가까워질 때만 받는다 (본문 사진은 모두 100vh 배너 아래, 첫 화면 밖).
#  - width·height: 파일에서 읽은 실제 크기. 브라우저가 사진 자리를 미리 잡아, 사진이 뜰 때 글이 밀리지 않는다 (CLS).
#    CSS(.post-content img)가 width 100%, height auto라 비율만 쓰인다.
#  - 마크다운에서 {: width="50%"}처럼 폭을 주면 그 폭으로 보여 준다 (아래 post_render 참고).
#  - alt="alt text"(마크다운 자리 표시)는 "포스트 제목 사진 N"으로 바꾼다. 직접 쓴 alt는 그대로 둔다.
# 배너 자리 표시 이미지(img-placeholder)와 이미 loading이 있는 이미지는 건너뛴다.
require "cgi"

module ImageAttrs
  @sizes = {}

  # [width, height] 또는 nil. AVIF(ispe·irot), PNG, JPEG를 읽는다.
  def self.size(path)
    return @sizes[path] if @sizes.key?(path)

    @sizes[path] = begin
      data = File.binread(path, 256 * 1024)
      case File.extname(path).downcase
      when ".avif" then avif_size(data)
      when ".png"  then data[16, 8].unpack("NN") if data[12, 4] == "IHDR"
      when ".jpg", ".jpeg" then jpeg_size(File.binread(path))
      end
    rescue StandardError
      nil
    end
  end

  # 가장 큰 ispe(그리드면 전체 크기)를 쓰고, irot이 90·270도면 가로세로를 바꾼다
  def self.avif_size(data)
    best = nil
    offset = 0
    while (i = data.index("ispe", offset))
      w, h = data[i + 8, 8].unpack("NN")
      best = [w, h] if w && h && (best.nil? || w * h > best[0] * best[1])
      offset = i + 4
    end
    if best && (r = data.index("irot")) && data.getbyte(r + 4).to_i.odd?
      best = best.reverse
    end
    best
  end

  def self.jpeg_size(data)
    i = 2
    while i < data.bytesize - 9
      i += 1 while data.getbyte(i) == 0xFF && data.getbyte(i + 1) == 0xFF
      marker = data.getbyte(i + 1)
      length = data[i + 2, 2].unpack1("n")
      if (0xC0..0xCF).cover?(marker) && ![0xC4, 0xC8, 0xCC].include?(marker)
        h, w = data[i + 5, 4].unpack("nn")
        return [w, h]
      end
      i += 2 + length
    end
    nil
  end
end

Jekyll::Hooks.register :posts, :post_render do |doc|
  next if doc.output.nil?

  site   = doc.site
  title  = CGI.escapeHTML(doc.data["title"].to_s)
  photo  = doc.data["lang"] == "en" ? "photo" : "사진"
  count  = 0

  doc.output = doc.output.gsub(/<img\b[^>]*>/) do |tag|
    next tag if tag.include?("img-placeholder")

    src   = tag[/\ssrc="([^"]+)"/, 1]
    local = src&.start_with?("/assets/")
    dims  = nil
    if local
      # %XX만 풀어 파일 경로로 ("+"는 그대로)
      path = src.split("?").first.gsub(/%(\h\h)/) { Regexp.last_match(1).hex.chr }.force_encoding("UTF-8")
      dims = ImageAttrs.size(File.join(site.source, path))
    end

    # 마크다운에서 직접 준 표시 크기 (외부 이미지에도 적용):
    #   {: width="50%"} / {: width="400"}  폭
    #   {: height="300"}                   높이
    #   {: size="300"}                     긴 변 (가로든 세로든 긴 쪽이 300px)
    #   {: size="50%"}                     긴 변 방향으로 % (가로 사진은 본문 폭, 세로 사진은 화면 높이의 50%)
    # 숫자만 쓰면 px. 여럿 주면 width > height > size 순으로 하나만 쓴다.
    # CSS가 width 100%를 강제하므로 style로 옮기고 원래 속성은 지운다.
    # 파일 크기를 아는 /assets 사진은 height·size도 폭(px)으로 바꾼다. 지연 로딩 중에도
    # 자리가 잡히고, 화면이 좁으면 비율대로 줄어든다.
    px    = ->(name) { tag[/\s#{name}="(\d+(?:\.\d+)?)(?:px)?"/, 1]&.to_f }
    shown = tag[/\swidth="(\d+(?:\.\d+)?(?:px|%)?)"/, 1]
    shown += "px" if shown&.match?(/\d\z/)
    style = if shown
              "width: #{shown}"
            elsif (h = px.("height"))
              dims ? "width: #{(h * dims[0] / dims[1]).round}px" : "width: auto; height: #{h.round}px"
            elsif (pct = tag[/\ssize="(\d+(?:\.\d+)?)%"/, 1])
              if dims.nil?
                "width: auto; max-width: #{pct}%; max-height: #{pct}vh; max-height: #{pct}svh"
              elsif dims[0] >= dims[1]
                "width: #{pct}%"
              else
                "width: auto; height: #{pct}vh; height: #{pct}svh"
              end
            elsif (l = px.("size"))
              if dims
                "width: #{(l * dims[0] / dims.max).round}px"
              else
                "width: auto; max-width: min(#{l.round}px, 100%); max-height: #{l.round}px"
              end
            end
    if style
      tag = tag.gsub(/\s(?:width|height|size)="[^"]*"/, "")
      tag = if tag.match?(/\sstyle="/)
              tag.sub(/\sstyle="/, %( style="#{style}; ))
            else
              tag.sub(/<img\b/, %(<img style="#{style}"))
            end
    end

    next tag unless local
    next tag if tag.match?(/\sloading=/)

    count += 1
    attrs = +' loading="lazy" decoding="async"'
    attrs << %( width="#{dims[0]}" height="#{dims[1]}") if dims && !tag.match?(/\swidth=/)
    tag = tag.sub(/\salt="alt text"/, %( alt="#{title} #{photo} #{count}")) unless title.empty?
    tag.sub(/<img\b/, "<img#{attrs}")
  end
end

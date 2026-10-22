# frozen_string_literal: true
#
# 포스트 본문 사진(<img src="/assets/...">)을 빌드할 때 손본다.
#  - loading="lazy" decoding="async": 화면에 가까워질 때만 받는다 (본문 사진은 모두 100vh 배너 아래, 첫 화면 밖).
#  - width·height: 파일에서 읽은 실제 크기. 브라우저가 사진 자리를 미리 잡아, 사진이 뜰 때 글이 밀리지 않는다 (CLS).
#    CSS(.post-content img)가 width 100%, height auto라 비율만 쓰인다.
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
    src = tag[/\ssrc="([^"]+)"/, 1]
    next tag unless src&.start_with?("/assets/")
    next tag if tag.include?("img-placeholder") || tag.match?(/\sloading=/)

    count += 1
    attrs = +' loading="lazy" decoding="async"'
    unless tag.match?(/\swidth=/)
      # %XX만 풀어 파일 경로로 ("+"는 그대로)
      path = src.split("?").first.gsub(/%(\h\h)/) { Regexp.last_match(1).hex.chr }.force_encoding("UTF-8")
      dims = ImageAttrs.size(File.join(site.source, path))
      attrs << %( width="#{dims[0]}" height="#{dims[1]}") if dims
    end
    tag = tag.sub(/\salt="alt text"/, %( alt="#{title} #{photo} #{count}")) unless title.empty?
    tag.sub(/<img\b/, "<img#{attrs}")
  end
end

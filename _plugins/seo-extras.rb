# frozen_string_literal: true
#
# 검색·공유용 문서 정보 (jekyll-seo-tag, _includes/seo-i18n.html이 쓴다).
#
# translations: 같은 글의 번역이 있는 언어 목록 (hreflang).
#   polyglot은 :post_read 훅에서 활성 언어가 아닌 문서를 걸러 내므로, 그보다 먼저(priority: :high) 모든 언어의
#   문서를 보고 기록해 둔다. 같은 글인지는 polyglot과 같은 기준(page_id, 없으면 url)으로 판단한다.
#
# image: 링크 미리보기(og:image) 사진. front matter에 image가 없으면
#   assets/og/<배너 폴더 이름>.jpg (_tools/make-og-images.sh가 배너로 만든 1200px JPEG)를 쓰고,
#   배너가 없는 페이지(홈 등)는 assets/og/home.jpg를 쓴다. 대부분의 SNS·메신저가 AVIF 미리보기를 못 하기 때문이다.
#
# canonical_url: jekyll-seo-tag가 쓰는 대표 주소. 언어마다 따로 정해야 해서 렌더 직전에 넣는다.
#   번역이 없어 기본 언어 글을 /en/ 아래에도 그대로 만든 페이지(rendered_lang ≠ active_lang)는 원래 주소를,
#   나머지는 지금 언어의 주소(기본 언어가 아니면 /en/ 등)를 가리킨다.
#   polyglot은 rel="canonical" 바로 뒤의 href에는 /en/을 붙이지 않으므로 이 값이 그대로 나간다.
Jekyll::Hooks.register [:pages, :documents], :pre_render do |doc, payload|
  site    = doc.site
  default = site.config["default_lang"] || "en"
  active  = site.respond_to?(:active_lang) ? site.active_lang : default
  lang    = doc.data["rendered_lang"] || doc.data["lang"] || default
  base    = "#{site.config['url']}#{site.config['baseurl']}"
  url     = lang != active || active == default ? "#{base}#{doc.url}" : "#{base}/#{active}#{doc.url}"
  doc.data["canonical_url"] = url
  payload["page"]["canonical_url"] = url if payload["page"].is_a?(Hash)
end

Jekyll::Hooks.register :site, :post_read, priority: :high do |site|
  default_lang = site.config["default_lang"] || "en"
  docs = site.collections.values.flat_map(&:docs) + site.pages
  key  = ->(doc) { doc.data["page_id"] || doc.url }

  langs = Hash.new { |h, k| h[k] = [] }
  docs.each { |doc| langs[key.(doc)] |= [doc.data["lang"] || default_lang] }

  og_dir = File.join(site.source, "assets", "og")
  docs.each do |doc|
    doc.data["translations"] = langs[key.(doc)].sort

    next if doc.data["image"]
    banner = doc.data["banner"]
    banner = banner["image"] if banner.is_a?(Hash)
    name   = banner.is_a?(String) && !banner.empty? ? File.basename(File.dirname(banner)) : "home"
    if File.exist?(File.join(og_dir, "#{name}.jpg"))
      doc.data["image"] = "/assets/og/#{name}.jpg"
    elsif banner.is_a?(String) && !banner.empty?
      doc.data["image"] = banner
    end
  end
end

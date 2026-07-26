# frozen_string_literal: true
#
# jekyll-spaceship's video matcher has no extension boundary after "avi", so
# every .avif image gets rewritten into <video style="max-width: 600px"> and
# renders at a fixed width instead of following the .post-content img rules.
# We never embed .avi videos, so drop that extension from the matcher.
require "jekyll-spaceship"
require "jekyll-spaceship/processors/media-processor"

module Jekyll::Spaceship
  class MediaProcessor
    def handle_normal_video(element)
      handle_media(element, {
        media_type: 'video',
        host: '(https?:\\/\\/)?.*\\/',
        id: '(.+?\\.(mp4|webm|ogg|ogv|flv|mkv|mov|wmv|3gp|rmvb|asf))'
      })
    end
  end
end

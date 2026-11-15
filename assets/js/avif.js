document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('video[id$=".avi"]').forEach(function(video) {
    const source = video.querySelector('source');
    if (source && source.src.endsWith('.avif')) {
      const img = document.createElement('img');
      img.src = source.src;
      img.alt = video.id.replace('media-', '');
      img.style.cssText = video.style.cssText;
      img.className = video.className;
      video.parentNode.replaceChild(img, video);
    }
  });
});
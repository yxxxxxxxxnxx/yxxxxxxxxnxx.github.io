document.addEventListener('DOMContentLoaded', function() {
  const videos = [
    '/assets/videos/flatiron.mp4',
    '/assets/videos/skate.mp4',
    '/assets/videos/subway.mp4'
  ];

  const randomIndex = Math.floor(Math.random() * videos.length);
  const randomVideo = videos[randomIndex];

  const videoElement = document.getElementById('home-banner-video');
  if (videoElement) {
    videoElement.src = randomVideo;
  }
});
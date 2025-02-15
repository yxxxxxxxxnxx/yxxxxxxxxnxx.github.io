document.addEventListener('DOMContentLoaded', function() {
  const videos = [
    '/assets/videos/seoul-1.mp4',
    '/assets/videos/seoul-2.mp4',
    '/assets/videos/seoul-3.mp4'
  ];

  const randomIndex = Math.floor(Math.random() * videos.length);
  const randomVideo = videos[randomIndex];

  const videoElement = document.getElementById('home-banner-video');
  if (videoElement) {
    videoElement.src = randomVideo;
  }
});
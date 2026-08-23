<?php
use PanicMic\Support\QrCode;
use PanicMic\Support\Url;
use function PanicMic\Support\e;

$requestUrl = $tenant['public_request_url'] ?: ('http://' . ($_SERVER['HTTP_HOST'] ?? '') . Url::path('/'));
$screenId = preg_replace('/[^a-z0-9_-]/i', '', (string)($_GET['screen'] ?? '')) ?: 'main';
$requestQr = QrCode::svg($requestUrl, 320);
?>
<section class="display-shell" data-screen="<?= e($screenId) ?>">

  <!-- Every screen — not just "main" — starts muted by default
       (display_screens.muted, KJ-toggleable from the Connected Displays
       panel on the console) so a remote/auxiliary screen (Side Screen,
       Bar TV, Patio TV, ...) never surprises the room with sound before
       the KJ decides it should have any, e.g. a screen in a separate
       room with its own speakers. Independently of that KJ-controlled
       toggle, browsers also block unmuted autoplay until the page has
       had a real user gesture, so this small pill (or any tap/click on
       the page — see display.js) banks that gesture ahead of time; a
       later KJ unmute then takes effect immediately without needing
       anyone to be standing in front of the screen. It's deliberately
       non-blocking: an unattended display still shows video and queue
       normally while muted, instead of being hidden behind a gate. -->
  <button type="button" class="display-audio-unlock" data-display-audio-unlock>
    <span class="display-audio-unlock-icon">🔊</span>
    <span>Tap to enable sound</span>
  </button>

  <!-- Stage: left area (video + overlays) -->
  <div class="display-stage">

    <!-- Now Playing / Up Next bar (top overlay) -->
    <div class="display-now-bar">
      <span class="display-now-label" data-display-now-label>NOW PLAYING</span>
      <div class="display-now-info">
        <strong data-display-now-title>Ready for requests</strong>
        <span data-display-now-singer></span>
      </div>
    </div>

    <!-- Viewport: player, between-singer screen, and lower-third stacked -->
    <div class="display-viewport">

      <!-- Video player (shown when mode === now_singing) -->
      <div class="display-player" data-display-player hidden>
        <div data-display-yt class="display-player-frame" hidden></div>
        <video data-display-video class="display-player-frame" playsinline muted hidden></video>
        <div data-display-player-empty class="display-player-empty" hidden>
          <h2 data-display-player-title></h2>
          <p>This song doesn't have an embedded video. Cue the source on the operator console.</p>
        </div>
      </div>

      <!-- Between-singer screen: large QR + "scan to add your song" -->
      <div class="display-between" data-display-between>
        <div class="display-between-qr"><?= $requestQr ?></div>
        <p class="display-between-cta">Scan to add your song</p>
      </div>
      <div class="display-idle-message" data-display-idle-message hidden>
        <strong>Ready for the next singer</strong>
        <span>Requests are open from the singer link.</span>
      </div>

      <!-- Lower third: singer name + song while playing -->
      <div class="display-lower-third" data-display-lower-third hidden>
        <strong data-display-lt-singer></strong>
        <span data-display-lt-song></span>
      </div>

    </div><!-- /.display-viewport -->
  </div><!-- /.display-stage -->

  <!-- Sidebar: right area (singer queue + QR) -->
  <aside class="display-sidebar">

    <div class="display-sidebar-header">
      <span class="display-sidebar-title">SINGER QUEUE</span>
      <span class="display-sidebar-venue"><?= e($tenant['venue_name']) ?></span>
    </div>

    <div class="display-upnext-label">UP NEXT</div>

    <div class="display-sidebar-queue" data-display-queue></div>

    <div class="display-wait-box" data-display-wait hidden></div>

    <div class="display-qr-box">
      <span class="display-qr-label">SCAN TO ADD YOUR SONG</span>
      <div data-qr><?= $requestQr ?></div>
      <p class="display-qr-url"><?= e($requestUrl) ?></p>
    </div>

  </aside><!-- /.display-sidebar -->

  <div class="display-announcement" data-display-announcement hidden></div>
</section>

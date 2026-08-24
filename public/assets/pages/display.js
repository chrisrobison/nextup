/* pages/display.js — fullscreen projector / display popout.
 *
 * Realtime sync prefers the WebSocket daemon (synchronized playback via
 * display:cue / display:play_at) and transparently falls back to
 * short-polling when the daemon isn't running. The BroadcastChannel
 * listener stays as the same-browser fast path for operator cues.
 */

import { appConfig, api } from '../lib/api.js';
import {
  loadQueue,
  renderDisplay,
  renderAdminStats,
  cueDisplayPlayer,
  playDisplayPlayerAt,
  getDisplayPlayerStatus,
  setScheduler,
  setServerNow,
  pauseDisplayPlayer,
  resumeDisplayPlayer,
  unlockDisplayAudio,
  muteDisplayPlayer,
  unmuteDisplayPlayer,
  enableSynchronizedPlayback,
  recoverDisplayPlayback,
} from '../lib/queue.js';
import { broadcast } from '../lib/broadcast.js';
import { startRealtime, sendDisplayReady, sendDisplayStatus, onMessage, scheduleAtServerTime, getServerNowMs, isConnected } from '../lib/ws.js';

function startDisplayBroadcastListener() {
  broadcast.subscribe(async data => {
    if (!data || !data.action) return;
    if (data.screen && data.screen !== 'all' && data.screen !== appConfig.screen) return;
    try {
      const [stateResp, queueResp] = await Promise.all([
        api(`/api/display/state?screen=${encodeURIComponent(appConfig.screen)}`),
        api(`/api/queue?screen=${encodeURIComponent(appConfig.screen)}`),
      ]);
      renderDisplay(queueResp.queue || [], stateResp.display || queueResp.display || {});
      renderAdminStats(queueResp.queue || []);
    } catch (_) {}
  });
}

export function init() {
  // Let queue.js schedule synchronized playback against server time, and
  // give its catch-up math (recoverDisplayPlayback) the same clock-offset
  // corrected "now" instead of the display's own possibly-skewed clock.
  setScheduler(scheduleAtServerTime);
  setServerNow(getServerNowMs);
  enableSynchronizedPlayback();

  // Sound stays muted until a real click/tap happens somewhere on the page
  // — required by every browser's autoplay-with-sound policy. Once
  // unlocked it stays unlocked for the rest of this page's life (until
  // reloaded), so this only needs to fire once per display session. The
  // pill button is a visible target for it, but an unattended remote/bar
  // TV should never be blocked by a full-screen gate waiting for someone
  // to specifically hit that button — any tap/click anywhere on the
  // display (the video, the queue, the background) satisfies the same
  // browser requirement, so listen for that too and dismiss the pill.
  // Bound on document (not just the pill) — a click on the button bubbles
  // up and is caught here too, so one listener covers both cases.
  const audioUnlockButton = document.querySelector('[data-display-audio-unlock]');
  const handleUnlockGesture = () => {
    unlockDisplayAudio();
    if (audioUnlockButton) audioUnlockButton.hidden = true;
    document.removeEventListener('click', handleUnlockGesture);
    document.removeEventListener('touchend', handleUnlockGesture);
  };
  document.addEventListener('click', handleUnlockGesture);
  document.addEventListener('touchend', handleUnlockGesture);

  // BroadcastChannel listener (same-browser fast path — unchanged).
  startDisplayBroadcastListener();

  // Realtime: prefers WS, falls back to short-poll. Every EventBus event
  // (WS daemon or short-poll fallback, same shape either way) also flows
  // through here, so display:pause/display:resume from the KJ console's
  // "Pause" button are picked up without any daemon-side special-casing.
  startRealtime(events => {
    for (const e of events || []) {
      const screen = e.payload?.screen || 'all';
      if (screen !== 'all' && screen !== appConfig.screen) continue;
      if (e.event_name === 'display:pause') pauseDisplayPlayer();
      if (e.event_name === 'display:resume') resumeDisplayPlayer();
      if (e.event_name === 'display:mute') muteDisplayPlayer();
      if (e.event_name === 'display:unmute') unmuteDisplayPlayer();
      // With WebSockets, typed cue/play-at messages follow the generic event
      // and are handled below. Polling has no typed channel, so translate the
      // same persisted events here.
      if (!isConnected() && e.event_name === 'display:cue') {
        const video = e.payload?.video || {};
        cueDisplayPlayer({ requestId: e.payload?.requestId, ...video });
      }
      if (!isConnected() && e.event_name === 'display:play_at') {
        playDisplayPlayerAt(
          Number(e.payload?.startAtServerMs) || Date.now(),
          Number(e.payload?.offsetSeconds) || 0,
        );
      }
    }
    loadQueue().catch(() => {});
  });

  // Typed WS commands for synchronized playback.
  onMessage(msg => {
    if (!msg || !msg.type) return;
    if (msg.type === 'display:cue') {
      const { screen, video, requestId } = msg;
      if (screen && screen !== 'all' && screen !== appConfig.screen) return;
      cueDisplayPlayer({ requestId, ...video }, () => {
        sendDisplayReady({
          screen: appConfig.screen,
          requestId,
          videoId: (video && (video.youtubeVideoId || video.videoUrl)) || '',
          provider: video && video.provider,
        });
      });
    }
    if (msg.type === 'display:play_at') {
      const { screen, startAtServerMs, offsetSeconds } = msg;
      if (screen && screen !== 'all' && screen !== appConfig.screen) return;
      playDisplayPlayerAt(startAtServerMs, offsetSeconds || 0);
    }
  });

  // Periodic status reports while on the display page.
  setInterval(() => {
    const status = getDisplayPlayerStatus();
    if (status) sendDisplayStatus({ screen: appConfig.screen, ...status });
  }, 2000);

  // Initial load.
  loadQueue().then(data => recoverDisplayPlayback(data.display || {})).catch(() => {});
}

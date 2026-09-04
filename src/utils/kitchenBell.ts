import { Platform } from 'react-native';
import Sound from 'react-native-sound';

/**
 * Looping kitchen ringtone for incoming food orders.
 * Android: android/app/src/main/res/raw/incoming_ring.mp3
 * iOS: ios/frestonow_Vendor/incoming_ring.mp3 (bundle resource)
 */
Sound.setCategory('Playback', true);

let player: Sound | null = null;
let loading = false;
let muted = false;
let wantPlaying = false;
const pending: Array<() => void> = [];

function flushPending() {
  const queue = pending.splice(0, pending.length);
  queue.forEach(fn => fn());
}

function ensurePlayer(onReady: () => void) {
  if (player?.isLoaded()) {
    onReady();
    return;
  }

  pending.push(onReady);
  if (loading) {
    return;
  }

  loading = true;
  // Android MAIN_BUNDLE resolves against res/raw (extension stripped).
  // iOS MAIN_BUNDLE resolves against the app bundle resource.
  player = new Sound('incoming_ring.mp3', Sound.MAIN_BUNDLE, error => {
    loading = false;
    if (error) {
      console.warn('[kitchenBell] failed to load incoming_ring', error);
      player = null;
      pending.splice(0, pending.length);
      return;
    }
    flushPending();
  });
}

function playLoaded() {
  if (!player?.isLoaded() || muted || !wantPlaying) {
    return;
  }
  player.setNumberOfLoops(-1);
  player.setVolume(1);
  if (Platform.OS === 'android') {
    player.setSpeakerphoneOn(true);
  }
  if (!player.isPlaying()) {
    player.play(success => {
      if (!success) {
        console.warn('[kitchenBell] playback failed');
      }
    });
  }
}

export function isKitchenBellMuted() {
  return muted;
}

export function setKitchenBellMuted(next: boolean) {
  muted = next;
  if (next) {
    player?.stop();
  } else if (wantPlaying) {
    startKitchenBell();
  }
}

export function startKitchenBell() {
  wantPlaying = true;
  if (muted) {
    return;
  }
  ensurePlayer(playLoaded);
}

export function stopKitchenBell() {
  wantPlaying = false;
  player?.stop();
}

export function releaseKitchenBell() {
  wantPlaying = false;
  muted = false;
  player?.stop();
  player?.release();
  player = null;
  loading = false;
  pending.splice(0, pending.length);
}

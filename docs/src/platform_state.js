let audioEnabled = true;
let paused = false;
const audioListeners = new Set();
const pauseListeners = new Set();

function notify(listeners, value) {
  for (const listener of listeners) {
    try { listener(value); } catch (error) { console.error(error); }
  }
}

export function setPlatformAudioEnabled(enabled) {
  const next = enabled !== false;
  if (next === audioEnabled) return;
  audioEnabled = next;
  notify(audioListeners, audioEnabled);
}

export function setPlatformPaused(value) {
  const next = Boolean(value);
  if (next === paused) return;
  paused = next;
  notify(pauseListeners, paused);
}

export function subscribePlatformAudio(listener) {
  audioListeners.add(listener);
  listener(audioEnabled);
  return () => audioListeners.delete(listener);
}

export function subscribePlatformPause(listener) {
  pauseListeners.add(listener);
  listener(paused);
  return () => pauseListeners.delete(listener);
}

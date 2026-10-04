import L from 'leaflet';

/**
 * A touch device with a big screen. Two-finger gestures are comfortable there, so its route maps can be moved and
 * zoomed while one finger still scrolls the page. Phones keep still maps, because a map that takes over the screen
 * traps the page's scrolling. `screen` reports CSS pixels, so the short side is the same in either orientation.
 */
export function isTablet() {
  const { width = 0, height = 0 } = window.screen ?? {};
  return L.Browser.mobile && Math.min(width, height) >= 600;
}

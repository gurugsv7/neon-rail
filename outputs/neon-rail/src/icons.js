// Shared vector artwork for the HUD and canvas textures on collectible badges.
export const ICON_PATHS={
  magnet:'M5 4v10a7 7 0 0 0 14 0V4h-4v10a3 3 0 0 1-6 0V4ZM5 8h4m6 0h4',
  boost:'M13 2 5 13h6l-1 9 9-12h-6Z',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6',
  board:'M5 8h14a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6ZM6 18h3m6 0h3M8 5h8',
  token:'m12 3 8 4.5v9L12 21l-8-4.5v-9ZM12 8v8',
  trophy:'M8 3h8v8a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v5m-4 1h8',
  route:'M8 21V3m8 18V3M8 6h8M8 12h8M8 18h8',
  radar:'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5m-5 0 8-8M12 12h.01',
  speed:'M4 19a10 10 0 1 1 16 0M12 14l5-6M5 12h1m12 0h1M12 5v1',
  sound:'M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted:'M3 9h4l5-5v16l-5-5H3Zm13 0 6 6m0-6-6 6',
  fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  camera:'M3 7h4l2-3h6l2 3h4v13H3ZM16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
  pause:'M8 5v14m8-14v14',
  switch:'M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4',
  jump:'M5 19v-5a7 7 0 0 1 14 0v5M8 7l4-4 4 4',
  slide:'M3 5h18M8 11h.01M5 20l6-5 7 1 3 4M11 15l-3-4',
  go:'m5 5 7 7-7 7m7-14 7 7-7 7',
  train:'M6 17V4h12v13ZM6 10h12M9 14h.01m6 0h.01M9 17l-3 4m9-4 3 4',
  check:'m5 12 4 4L19 6',
};
export function icon(name){return `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]||ICON_PATHS.go}"/></svg>`;}

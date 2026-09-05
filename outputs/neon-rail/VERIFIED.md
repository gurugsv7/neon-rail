# NEON RAIL 1.0.1 — verification

Open **NEON RAIL.html** directly, or double-click **PLAY.cmd**. The game includes all rendering code, models, materials and audio; no server or downloads are needed to play.

The train update passed **34 browser regression checks**:

- Incoming trains continue at 18 metres per second through the encounter and recycle after passing the player. Their motion no longer stops at a displacement cap.
- Train roofs are 4.27 metres high. The normal jump apex is approximately 2.98 metres. Eighteen combinations of train type, running speed and jump timing confirmed that ground jumps cannot bypass trains.
- Extended ramps reach the roof. Roof jumps, airborne lane changes, falling and ground landings work.
- Lane dodges, shield protection, hoverboard protection, low-obstacle jumps and slides still work.
- Three separate 12-minute generated runs each covered 20.8 km with **zero collisions**. The controller followed a clear lane through each pattern, with shields and boards disabled.
- No console or JavaScript errors were observed during those checks. The revised train geometry and roof camera were inspected in screenshots.

The core tests validate **100,000 generated patterns**. A conservative moving-train envelope leaves at least 0.80 seconds between patterns at maximum running speed, covering the lane transition and reaction allowance. Run `npm test` to repeat these dependency-free tests with Node.js.

The initial full-game verification also covered all four pickups and their timers, scoring, missions, pause/resume, restart, game over, save persistence, fullscreen, offline launch, and resizing to 1366×768, 1920×1080 and 2560×1440. A rendered 12-minute endurance test kept geometry and texture counts stable after warm-up.

Hardware acceleration is required for good performance. The 3D rendering budget is capped at 1920×1080; the interface remains at the display's full resolution. Frame rate depends on GPU and concurrent workload.

The detailed train regression results are in **train-verification.json**.

# NEON RAIL 1.0.1 â€” verification

Open **NEON RAIL.html** directly, or double-click **PLAY.cmd**. The game includes all rendering code, models, materials and audio; no server or downloads are needed to play.

The train update passed **34 browser regression checks**:

- Incoming trains continue at 18 metres per second through the encounter and recycle after passing the player. Their motion no longer stops at a displacement cap.
- Train roofs are 4.27 metres high. The normal jump apex is approximately 2.98 metres. Eighteen combinations of train type, running speed and jump timing confirmed that ground jumps cannot bypass trains.
- Extended ramps reach the roof. Roof jumps, airborne lane changes, falling and ground landings work.
- Lane dodges, shield protection, hoverboard protection, low-obstacle jumps and slides still work.
- Three separate 12-minute generated runs each covered 20.8 km with **zero collisions**. The controller followed a clear lane through each pattern, with shields and boards disabled.
- No console or JavaScript errors were observed during those checks. The revised train geometry and roof camera were inspected in screenshots.

The core tests validate **100,000 generated patterns**. A conservative moving-train envelope leaves at least 0.80 seconds between patterns at maximum running speed, covering the lane transition and reaction allowance. Run `npm test` to repeat these dependency-free tests with Node.js.

The initial full-game verification also covered all four pickups and their timers, scoring, missions, pause/resume, restart, game over, save persistence, fullscreen, offline launch, and resizing to 1366Ã—768, 1920Ã—1080 and 2560Ã—1440. A rendered 12-minute endurance test kept geometry and texture counts stable after warm-up.

Hardware acceleration is required for good performance. The 3D rendering budget is capped at 1920Ã—1080; the interface remains at the display's full resolution. Frame rate depends on GPU and concurrent workload.

The detailed train regression results are in **train-verification.json**.


## Motion and architecture update — 14 September 2026

Motion now uses velocity-adaptive filtering, stable-pose calibration, gesture latching, face continuity and tracking-loss recovery. A held raised pose triggers one jump; returning to neutral rearms it. Lowering the head sustains a slide. Worker sampling targets 12 Hz while still and 24 Hz during movement, with inference-cost throttling. Camera startup can be cancelled without leaving a live stream.

Dependency-free motion tests passed: synthetic lean recognition at 125 ms with 24 Hz samples, jitter/spike rejection, jump/duck rearming, loss recovery, face selection and preview geometry. This timing measures the signal pipeline, not total webcam latency. The 100,000-pattern core suite and 19 browser motion checks passed. The actual bundled face detector also mapped a synthetic camera face left/centre/right correctly, with no external requests or page errors. Camera activation, stopping and cancellation during a pending permission request passed. Human webcam use under varied lighting was not tested.

Procedural scenery now includes Sunvault brick arches, Switchworks copper service frames, Solarium Cut garden ribs, folded station canopies and bowstring footbridges. Geometry remains statically batched and reused with the existing scenery chunks. Station and tunnel views were inspected in-game; sampled scenes used approximately 335–341 draw calls and 252,000–289,000 triangles. These are rendering counts, not an FPS benchmark.


## Icon HUD update

Shared vector symbols now identify pickups, active powers, sound/camera controls, score, route and security status. Circular power timers retain seconds, tooltips and accessible labels. Keyboard hints fade after the opening stretch. Start, pickup, expiry and impact notifications use compact icon badges. Pickup faces gently turn without rotating edge-on.

Browser checks passed for all four power timers, expiry warnings/removal, threat indication, sound icon toggling, pause/resume/restart, and layouts at 1440x900, 800x600 and 390x844. HUD and collectible screenshots were inspected. No JavaScript errors were reported.


## Progressive difficulty update

Difficulty now scales with distance over the first 4,200 metres. Running speed rises from 17 to 36 m/s; incoming trains rise from 18 to 22 m/s. Paired incoming trains and adjacent escape-lane changes become much more common. Power-ups appear every three encounters early, falling to every five later.

The updated 100,000-pattern suite passes with a conservative 54 m combined train envelope and at least 0.50 seconds between hazard envelopes at maximum speed (0.18 seconds for switching plus 0.32 seconds reaction budget). This supersedes the earlier 30 m/s and 0.80-second difficulty figures above. Sampled early/late encounters averaged 84.5/73.5 metres apart; paired oncoming trains rose from 20% to 75%, and escape-lane changes from 45% to 95%. Motion signal tests also pass.
`nThree automated 210-second runs each reached 6.65 km with shields and boards disabled, zero collisions, and no browser errors. The controller followed the known escape lane; this verifies a playable route, not human difficulty.


## Split assets, rendering performance and gesture fix

This version replaces the self-contained HTML build: use PLAY.cmd or npm start and keep dist/ with the HTML. Models are fetched as cacheable GLB files rather than decoded from embedded base64. Camera worker, WASM and detector model load only on camera activation. HTML is approximately 5 KB; main JavaScript approximately 841 KB.

Rendering now skips scenery beyond the visible district and distant train models, uses a 1024-square shadow map, caps initial resolution at 1440x900, avoids HUD backdrop blurs, and reduces resolution gradually if sustained gameplay frames exceed 22 ms. Physics, difficulty and collision checks are unchanged. District indicator DOM only changes when the district changes.

Controlled headless Chromium test at the same 1440x900 tunnel viewpoint, 150 frames: median frame time 33.7 -> 16.8 ms; p95 70.1 -> 23.2 ms; frames over 33.4 ms 77 -> 1; draw calls 350 -> 269; triangles 293,620 -> 238,000. These measure one scene on this machine, not guaranteed frame rates on all hardware or during all encounters.

Head steering emits one relative lane step per lean, requiring neutral before another gesture. Neutral does not move the character. Node tests cover held poses, rearming, opposite gestures and starting in the right lane. A synthetic face processed by the actual detector confirmed right -> middle with one left lean, then middle -> right after neutral and one right lean. Lazy camera loading and camera activation passed with no external requests or page errors.

The split build also passed three automated 210-second runs to 6.65 km with zero collisions on the known escape route and no browser errors. The revised tunnel scene was visually inspected.


## Full-body camera mode — 15 September 2026

Camera controls now default to Full body, with a Head only switch. Google's Pose Landmarker Lite detects 33 landmarks in a worker, using GPU acceleration where available and CPU fallback. Its 5.5 MB model loads only when requested. The framing guide checks head, shoulders, hips, knees and ankles and requests left/right/back/closer adjustments, then requires a stable one-second calibration. A dashed frame and skeleton show tracking quality.

Alternating knee AND ankle lifts gate forward gameplay. Three alternating lifts start a run; holding a knee, head bobbing and standing do not qualify. A short step allowance avoids flicker. Stopping or losing visibility holds movement, incoming trains, collisions, score and power timers together. Leaning moves one lane per neutral-rearmed gesture. Both hands raised jumps; squatting slides. Keyboard/head-only fallback remains available. Webcam estimates are not Kinect depth measurements or proof of exercise intensity.

Tests: 100,000 generation patterns; head gesture tests; body framing/calibration/noise/held-knee/gait/stop/loss/jump/squat tests. Browser test used synthetic landmarks through the worker message path to verify body calibration, three-step activation, forward movement, stopping and incoming-train freeze. The actual bundled model separately detected 33 points on the official pose example, including knees/ankles. Camera activation, lazy loading, head-only switching and camera shutdown passed with no external requests or page errors. Setup UI inspected in screenshot. No live human jogging test has been performed; thresholds may need tuning for the user's camera and room.

Initial GPU shader warm-up is excluded from the steady sampling cost estimate. Pose sampling targets 18 Hz with a separate throttle from face tracking; measured incoming pose messages in the integration test were approximately 109 ms old. Actual throughput depends on hardware.


## Standing pursuit and capture sequence

Supersedes the earlier standing-freeze rule: once calibrated and visible,
standing stops forward travel and accumulates six seconds of pursuit pressure.
Jogging reduces that pressure at twice the accumulation rate. Incoming trains
and gameplay timers continue while standing. Tracking loss (including stale
body samples) freezes simulation and pursuit and displays Return to position;
recalibration is protected.

Losses now enter a 3.2-second capture state before showing results. The security
drone approaches, three staggered amber rings seal around the courier, and a
magnetic tether lifts/tows them as the camera orbits. The capture shot stages
in front of nearby obstacles to prevent trains hiding the animation. Geometry
is created once and reset between runs. Standing uses a held landing-pose frame.

Browser checks cover stationary distance, pursuit accumulation, tracking-loss
freeze, jogging escape, timed capture, tow, delayed results, restart, and an
actual train-collision capture. Screenshots inspected; no page errors observed.


## Mechanical interceptor redesign

The former two-ring drone and light-ring capture have been replaced. Security now uses four ducted fans with counter-rotating blade assemblies, guards, armor/service panels, underside winch hardware, a moving sensor gimbal, and navigation/status lamps. Stationary hardware is merged by material; rotating blades and the camera remain separate. The model is built once.

The capture now lasts 5.8 seconds: bank/brake and inspect; lower an articulated padded harness; close the jaws; tension the cable; lift with damped lateral sway; accelerate away. Courier clips transition from looking back through stumble to suspended fall, while the camera follows the recovery. Contact/lift sounds align with the mechanical phases. Nearby-obstacle staging, restart reset and tracking-pause behavior remain.

Browser checks passed for standing pursuit, lost-tracking freeze, jogging escape, capture timing, payload lift, delayed results, restart and train-collision capture, with zero page errors. Lift and train-collision views were visually inspected. Realism here refers to mechanical design and animated weight cues, not a rigid-body cable simulation.

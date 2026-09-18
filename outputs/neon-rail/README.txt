NEON RAIL
An original three-lane 3D arcade runner set on Meridian's golden-hour East Line.

MOTION CONTROL (CAMERA)
Press C or the camera button. Full body is the default camera mode.
Fit your head, knees and ankles inside the dashed frame. The preview guides
you left/right/back/closer; hold still for calibration. Clear enough space
around you to jog in place comfortably.
  alternate knee/ankle lifts  jog to move forward
  lean LEFT / RIGHT          move one lane; neutral rearms the next gesture
  raise BOTH hands           jump
  squat                      slide
Standing while fully tracked stops the courier, but security closes in.
Six seconds of accumulated standing triggers capture. Jogging pulls security
back; tracking loss freezes the scene and pursuit with Return to position.
Reposition and complete calibration to continue. Three alternating lifts
start movement, with a brief allowance between steps.
This recognises leg movement, not exercise intensity or verified running.

Choose Head only for seated controls (lean, head rise, head duck), or Use
keyboard to turn the camera off. R re-calibrates. Camera processing is local;
no video is uploaded or recorded. The lightweight pose model loads only when
full-body mode is enabled. Pose estimates are not Kinect depth measurements.

PLAY
Double-click PLAY.cmd (Node.js required), or run npm start in this folder.
Open http://127.0.0.1:8765 in Chrome, Edge, or Firefox. Keep this folder together: dist/ contains scripts and binary assets. Direct file:// launch is no longer supported. No account or internet connection is required after downloading the files.
To rebuild from source: npm install, then npm run build. npm run dev builds and serves.
Press F or the fullscreen icon for fullscreen.

CONTROLS
A / Left arrow       Move one lane left
D / Right arrow      Move one lane right
W / Up / Space       Jump; you can switch lanes in the air
S / Down             Slide; press in the air to drop quickly
Esc                  Pause / resume
M                    Toggle sound
F                    Fullscreen

READ THE TRACK
Mint hexagons are flux tokens. Token ribbons mark an open route.
Yellow low barriers can be jumped. KEEP LOW signs require a slide.
Wooden cargo can be jumped. Full-height trains cannot be cleared by a normal
ground jump: switch lanes or take a sloped gold access ramp onto a train roof.
Dark excavations require a jump or a lane change. Incoming trains sound a horn
and continue moving toward you until they pass. Every pattern has an open lane.
Two minor impacts close together let security catch you. A direct train or
cargo impact ends the run. A shield or board absorbs one crash.

POWER-UPS
Cyan magnet       Pulls tokens in from nearby lanes for 12 seconds.
Gold double mark  Doubles the current score multiplier for 14 seconds.
Blue shield       Protects against one collision, up to 25 seconds.
Pink board        Ride for 16 seconds; one crash destroys the board.

PROGRESSION
Five lifetime delivery missions each add +1 to your base score multiplier.
Best score and mission progress are saved in this browser on this device.
Private browsing or clearing browser data may remove saved progress.

The game combines supplied GLB models with procedural scenery and sound.
Rendering uses Three.js under the included MIT license.

SOURCE
src/core.js: movement physics, pattern validation, save data, missions.
src/art.js: procedural models, character rig, environment batching.
src/game.js: world lifecycle, collision, camera, feedback, UI and game states.
src/audio.js: procedural Web Audio soundtrack and sound effects.
src/style.css and src/shell.html: game interface.

SECURITY CAPTURE
The four-fan interceptor brakes, lowers a recovery harness, latches it,
tensions its winch and carries the courier away before results appear.

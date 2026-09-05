NEON RAIL
An original three-lane 3D arcade runner set on Meridian's golden-hour East Line.

PLAY
Double-click PLAY.cmd or open NEON RAIL.html in Chrome, Edge, or Firefox.
The game is fully offline. No installation, account, or server is required.
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

All character models, scenery, signage, animation and sounds are original
and generated in code. Rendering uses Three.js under the included MIT license.

SOURCE
src/core.js: movement physics, pattern validation, save data, missions.
src/art.js: procedural models, character rig, environment batching.
src/game.js: world lifecycle, collision, camera, feedback, UI and game states.
src/audio.js: procedural Web Audio soundtrack and sound effects.
src/style.css and src/shell.html: game interface.

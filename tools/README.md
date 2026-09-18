# Asset pipeline

Nothing in `assets/` is hand-modelled. These scripts turn CC0 kits and
generated meshes into GLBs a browser can hold at 60 fps, and they are **not
needed to run or build the game** — `assets/` already holds their output.

## Running them

```bash
cd tools && npm install
```

That pulls `meshoptimizer`, `sharp`, `fbx2gltf` and a copy of Three.js — heavy,
build-time-only dependencies, which is why they live here rather than in the
game's own `package.json`.

The scripts read from `tools/source-art/`, which is gitignored (~260 MB of
third-party binaries). To repopulate it, see the links in `CREDITS.md`.

| | |
|---|---|
| `stage-mediapipe.mjs` | Fetches the MediaPipe WASM and the pose/face models into `assets/mediapipe/`. This is the only one you are likely to need: `npm run assets:mediapipe` from the repo root. |
| `survey-kit.mjs` | Dumps geometry and palette facts for every model in a Kenney kit, so asset choices come from numbers rather than guesswork. |
| `kit-palette.mjs` | Shared retint: keeps each swatch's lightness, replaces hue and saturation, collapses a 95-model kit to 8 materials. |
| `optimize-buildings.mjs` | Kenney commercial + industrial kits → one vertex-coloured primitive per model, Int8-quantised normals. |
| `optimize-city.mjs` | Kenney road kit → barriers, signals, street furniture. |
| `optimize-rails.mjs` | Kenney train kit → rail and sleeper tiles split by swatch, including damaged variants. |
| `optimize-trees.mjs` | Quaternius OBJ → GLB with alpha-cut leaf materials. |
| `optimize-train.mjs`, `optimize-ramp-train.mjs` | Meshy generations → LOD chains via `meshoptimizer`. |
| `optimize-character.mjs` | Eleven Mixamo FBX clips → one skinned GLB: a single skeleton, clips merged by bone name, root motion stripped. |
| `layout-check.mjs` | Reports pairwise clearance between trackside props against the placement rules, so signals and trees cannot end up inside the train envelope. |

## Two things worth knowing

**Kenney kits ship one flat-swatch colormap** — every triangle samples a single
pixel. So the pipeline splits each model by swatch and bakes colour into
vertices; no texture ships at all. Note that glTF's UV origin is **top**-left
(`row = v * height`), and that `baseColorFactor` is linear, not sRGB. Both of
those cost an afternoon if you get them backwards.

**Meshy meshes are hundreds of detached shells.** `simplifyWithAttributes`
needs the `Permissive` flag or decimation floors out around 8.2k triangles,
nowhere near the target. `mergeGeometries` also returns `null` — silently
dropping a whole bucket — if the attribute sets differ, so imported geometry
has to carry a UV attribute even when nothing samples it.

# Explore V0.2 AMap Design QA

- Source visual truth: `C:\Users\1\.codex\generated_images\019ffa8f-d923-7bb0-9016-1b930d2d60c1\exec-55e65d28-ea90-4902-97dc-4a0cbd8e561a.png`
- Implementation screenshot: `D:\MyProject\nestProject\nestjs-h5\explore-amap-implementation.png`
- Side-by-side comparison: `D:\MyProject\nestProject\nestjs-h5\explore-amap-design-qa-comparison.png`
- State: `/explore`, real AMap loaded, map tab selected, a nearby quest selected.
- Viewport: 393 × 852 CSS px; device scale factor 1.
- Source pixels: 853 × 1844, normalized to the 378 px captured content width.
- Implementation pixels: 378 × 852; the remaining 15 px of the viewport is the vertical scrollbar.

**Findings**

- No actionable P0/P1/P2 differences remain.
- Fonts and typography: existing Noto Serif SC/Noto Sans SC hierarchy is preserved; long titles wrap without clipping.
- Spacing and layout rhythm: the map, torn-paper transition, task sheet and fixed navigation retain the selected composition. Long task copy remains scrollable.
- Colors and visual tokens: AMap uses the official `dark` style with a restrained warm, low-saturation treatment on map layers. Coral markers and warm ivory paper remain consistent with the source.
- Image quality and asset fidelity: the placeholder has been replaced by live vector/tile map content. The generated torn edge and paper texture remain raster assets. AMap logo and copyright remain visible and are positioned above the paper transition.
- Copy and content: task data is live API content; location names and coordinates are temporary V0.2 fixtures until the backend returns coordinates.

**Full-view comparison evidence**

- The side-by-side comparison confirms the same visual hierarchy, dark city-map character, marker prominence, segmented controls, paper transition and bottom navigation.
- The live map is intentionally less illustrative than the generated atlas source because it remains pannable and zoomable.

**Focused region comparison evidence**

- The map region was inspected at original resolution. Four AMap marker overlays are visible, readable and selectable.
- The attribution region was inspected after adjustment; legal attribution remains fully visible on the dark map and no longer collides with the parchment content.

**Comparison history**

1. Initial P2: official `darkblue` was too saturated and modern compared with the selected ink-map direction; attribution sat on the paper transition.
2. Fix: changed the base map to official `dark`, applied the muted treatment only to AMap layers, and moved attribution above the torn edge.
3. Initial P2: mouse selection left a large focus rectangle around a marker.
4. Fix: pointer clicks now blur the marker while keyboard activation retains `:focus-visible` accessibility treatment.
5. Post-fix evidence: final comparison shows a subdued map, clean selected marker state, visible attribution and no console warnings/errors.

**Primary interactions tested**

- AMap JS API 2.0 loads successfully with the configured Web JS API key.
- Four custom task markers render over the live map.
- Selecting a marker updates the task card title, copy and destination.
- Map/list/saved navigation remains intact.
- Production build passes; browser console has no errors or warnings.

**Follow-up polish**

- P3: for a closer engraved-atlas result, create and publish a style in the AMap custom style editor, then set `VITE_AMAP_STYLE_ID` without changing the component structure.
- P3: replace temporary Hangzhou coordinates with backend `latitude` and `longitude` fields.

final result: passed

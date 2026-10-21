# Design

## Look

- **Tokens** live in `packages/ui/src/styles.css`: a neutral zinc palette, the Geist typeface
  (self-hosted), light and dark themes (following the system, or the switch in the header).
- **One accent per site**, from `accent` in the registry: images blue, PDF red, video teal, audio
  pink, QR orange, OCR green, developer purple, calculators cyan, colours amber, music indigo.
  The hub is neutral ink; its colour comes from the sites.
- **Logos** are drawn once in `packages/ui/src/lib/brand.ts` (`markSvg`): a rounded square in the
  site's accent with a white glyph. The same drawing becomes the header logo, favicons, app icons
  and social preview images.
- **No decoration in editors.** Only images get the transparency checkerboard, because there it
  means something.

## Pages

- **Home:** a large drop box, popular tools, a scrolling showcase of every tool, popular tasks,
  a privacy note and the other sites.
- **Tool pages:** a header band (breadcrumbs, icon, title, Simple/Advanced switch), the tool, a
  card with three steps and three answers, related tasks, other tools.
- **Lists stay short:** menus show the top three tools per group with "+ N more"; footer columns
  have at most six links.

## Tools

- **Simple first.** A tool opens with two or three controls, a before/after view where the look
  changes, the result and a Download button.
- **Advanced** (image tools) is a workspace at `/editor?t=<tool>`: every tool in a rail, the
  picked tool's panel first, other edits folded under "More edits", a Changes list (hide, remove,
  open), undo/redo and a History list, per-photo changes in batches.
- **Editors keep their size.** Settings panels scroll inside the card; the preview never jumps
  when a setting adds a line. `tests/layout-sweep.ts` checks this.
- **Every editor can zoom** (− / level / + / Fit; 100% is one image pixel per screen pixel).

## Writing

- Sentence case, plain verbs, no ALL-CAPS labels, no arrows in buttons.
- Say what happens: "Download all 3 as zip", not "Submit".
- Say what's positive: "Your files stay on your device", not "Nothing is uploaded".
- Errors explain what went wrong and what to do, and don't apologise.
- Every string goes through `T()` / `t()` and has a Bangla translation.

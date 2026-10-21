/**
 * MusicTool in the browser: the metronome's real schedule (evenly spaced at the BPM, accents,
 * subdivisions, speed trainer, keys), tap tempo, the tone generator measured through its
 * analyser, the drone, chord diagrams checked note by note, scales on the fretboard and piano,
 * the ear trainer's score, every use case's preset, the Bangla pages, and a coverage check.
 */
import type { Page } from "@playwright/test";
import { getApp } from "../../packages/registry/src/index.ts";
import { expect, openTool, test } from "../helpers.ts";

const app = getApp("musictool");
const area = (page: Page) => page.locator(".tool-area");
const btn = (page: Page, name: string | RegExp) =>
  area(page)
    .getByRole("button", { name, exact: typeof name === "string" })
    .first();

interface Tick {
  time: number;
  bar: number;
  beat: number;
  sub: number;
  level: number;
  bpm: number;
}
const log = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { kmraMusic: { metronome: { log: Tick[] } } }
    ).kmraMusic.metronome.log.map((t) => ({ ...t })),
  );
const bpm = (page: Page) =>
  area(page).locator(".mt-bpm").getAttribute("data-value").then(Number);

/** Gaps between consecutive clicks */
const gaps = (ticks: Tick[]) =>
  ticks.slice(1).map((t, i) => t.time - ticks[i]!.time);

test("metronome: clicks evenly spaced at the BPM, with the downbeat accented", async ({
  page,
}) => {
  await openTool(page, "/metronome");
  await area(page).locator(".mt-bpm-slider").fill("150");
  await expect(area(page).locator(".mt-bpm")).toHaveAttribute(
    "data-value",
    "150",
  );
  await expect(area(page).locator(".mt-tempo-name")).toHaveText("Allegro");
  await btn(page, "Start").click();
  // The beat lights follow the audio clock
  await expect(area(page).locator(".mt-dot.on")).toHaveCount(1);
  await page.waitForTimeout(1800);
  const ticks = await log(page);
  expect(ticks.length).toBeGreaterThanOrEqual(5);
  for (const g of gaps(ticks)) expect(g).toBeCloseTo(0.4, 6);
  expect(ticks.slice(0, 5).map((t) => t.level)).toEqual([3, 2, 2, 2, 3]);
  await btn(page, "Stop").click();
  await expect(area(page).locator(".mt-dot.on")).toHaveCount(0);
});

test("metronome: accents, triplets and time signatures", async ({ page }) => {
  await openTool(page, "/metronome");
  const dots = area(page).locator(".mt-dot");
  await expect(dots).toHaveCount(4);
  // Click beat 2 to mute it, beat 3 twice to accent it
  await btn(page, "Beat 2: normal").click();
  await expect(dots.nth(1)).toHaveAttribute("data-level", "mute");
  await btn(page, "Beat 3: normal").click();
  await btn(page, "Beat 3: muted").click();
  await expect(dots.nth(2)).toHaveAttribute("data-level", "accent");
  await area(page)
    .getByRole("group", { name: "Subdivision" })
    .getByRole("button", { name: "Triplets" })
    .click();
  await area(page).locator(".mt-bpm-slider").fill("100");
  await btn(page, "Start").click();
  await page.waitForTimeout(2000);
  await btn(page, "Stop").click();
  const ticks = await log(page);
  for (const g of gaps(ticks)) expect(g).toBeCloseTo(0.2, 6);
  // beat 1 accent + 2 subdivisions, beat 2 silent, beat 3 accent
  expect(ticks.slice(0, 9).map((t) => t.level)).toEqual([
    3, 1, 1, 0, 0, 0, 3, 1, 1,
  ]);

  // 7/8 groups 2 + 2 + 3
  await area(page)
    .getByRole("group", { name: "Time signature" })
    .getByRole("button", { name: "7/8" })
    .click();
  await expect(dots).toHaveCount(7);
  expect(
    await dots.evaluateAll((d) => d.map((x) => x.getAttribute("data-level"))),
  ).toEqual([
    "accent",
    "normal",
    "accent",
    "normal",
    "accent",
    "normal",
    "normal",
  ]);
  // Custom: 11/16
  await area(page).getByRole("button", { name: "Custom" }).click();
  await area(page).getByLabel("Beats per bar").fill("11");
  await area(page).getByLabel("Beats per bar").press("Enter");
  await area(page)
    .getByRole("group", { name: "Beat unit" })
    .getByRole("button", { name: "16" })
    .click();
  await expect(dots).toHaveCount(11);
  await expect(area(page).locator(".mt-sig")).toContainText("11/16");
});

test("metronome: speed trainer raises the tempo every few bars", async ({
  page,
}) => {
  await openTool(page, "/metronome");
  await area(page)
    .getByRole("group", { name: "Time signature" })
    .getByRole("button", { name: "2/4" })
    .click();
  await area(page).locator(".mt-bpm-slider").fill("240");
  await area(page).getByLabel("Speed trainer").check();
  for (const [name, v] of [
    ["Raise by", "10"],
    ["Every", "1"],
    ["Up to", "270"],
  ])
    (await area(page).getByLabel(name, { exact: true }).fill(v),
      await area(page).getByLabel(name, { exact: true }).press("Tab"));
  await expect(area(page).locator(".mt-group .mt-hint")).toHaveText(
    "Adds 10 BPM every 1 bars until 270 BPM.",
  );
  await btn(page, "Start").click();
  await expect.poll(() => bpm(page), { timeout: 10_000 }).toBe(270);
  await btn(page, "Stop").click();
  const ticks = await log(page);
  const firstAt = (b: number) => ticks.find((t) => t.bpm === b);
  expect(firstAt(250)!.bar).toBe(1);
  expect(firstAt(260)!.bar).toBe(2);
  expect(firstAt(270)!.bar).toBe(3);
  // A beat at 240 BPM lasts 0.25 s, at 250 BPM 0.24 s
  expect(firstAt(250)!.time - ticks[0]!.time).toBeCloseTo(0.5, 6);
});

test("metronome: keyboard shortcuts and tap", async ({ page }) => {
  await openTool(page, "/metronome");
  await page.locator("h1").click();
  await page.keyboard.press("ArrowUp");
  expect(await bpm(page)).toBe(101);
  await page.keyboard.press("Shift+ArrowDown");
  expect(await bpm(page)).toBe(91);
  await page.keyboard.press("Space");
  await expect(btn(page, "Stop")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(btn(page, "Start")).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("t");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => bpm(page)).toBeGreaterThan(110);
  expect(await bpm(page)).toBeLessThan(130);
});

test("tap tempo: BPM from taps, and into the metronome", async ({ page }) => {
  await openTool(page, "/tap-tempo");
  const pad = area(page).locator(".mt-tap-pad");
  for (let i = 0; i < 8; i++) {
    await pad.click();
    await page.waitForTimeout(400);
  }
  const value = Number(
    await area(page).locator(".mt-tap-bpm").getAttribute("data-value"),
  );
  expect(value).toBeGreaterThan(140);
  expect(value).toBeLessThan(160);
  const whole = Number(
    await area(page).locator('[data-id="whole"] dd').getAttribute("data-value"),
  );
  expect(whole).toBe(Math.round(value));
  await expect(area(page).locator('[data-id="steady"] dd')).not.toHaveText("–");
  await area(page).getByRole("link", { name: "Use in metronome" }).click();
  await expect(page).toHaveURL(new RegExp(`/metronome\\?bpm=${whole}$`));
  await expect(area(page).locator(".mt-bpm")).toHaveAttribute(
    "data-value",
    String(whole),
  );
  // Keyboard taps work too, and Esc starts over
  await page.goto("/tap-tempo");
  await area(page).locator(".mt-tap-pad").waitFor();
  await page.keyboard.press("Space");
  await expect(area(page).locator(".mt-tap-hint")).toHaveText("Keep tapping");
  await page.keyboard.press("Escape");
  await expect(area(page).locator(".mt-tap-bpm")).toHaveText("–");
});

const tone = (page: Page) =>
  page.evaluate(() => {
    const t = (
      window as unknown as { kmraMusic: { tone: { osc: OscillatorNode } } }
    ).kmraMusic.tone;
    return { freq: t.osc.frequency.value, type: t.osc.type };
  });
const peak = (page: Page) =>
  area(page).locator(".mt-tone-read").getAttribute("data-peak").then(Number);

test("tone generator: plays the frequency you set (measured)", async ({
  page,
}) => {
  await openTool(page, "/tone-generator");
  const freq = area(page).locator('input[name="freq"]');
  await freq.fill("1000");
  await freq.press("Enter");
  await expect(area(page).locator(".mt-tone-hz")).toContainText("1000");
  await expect(area(page).locator(".mt-tone-note")).toContainText("B5");
  await btn(page, "Play").click();
  await expect.poll(() => peak(page)).toBeGreaterThan(990);
  expect(Math.abs((await peak(page)) - 1000)).toBeLessThan(10);
  expect((await tone(page)).freq).toBeCloseTo(1000, 3);
  // A note from the picker: A3 = 220 Hz, applied while playing
  await area(page).getByLabel("Note", { exact: true }).selectOption("9");
  await area(page).getByLabel("Octave", { exact: true }).selectOption("3");
  await expect(freq).toHaveValue("220");
  await expect.poll(() => peak(page)).toBeLessThan(225);
  expect(Math.abs((await peak(page)) - 220)).toBeLessThan(5);
  await area(page)
    .getByRole("group", { name: "Wave" })
    .getByRole("button", { name: "Square" })
    .click();
  expect((await tone(page)).type).toBe("square");
  await btn(page, "Stop").click();
  await expect(btn(page, "Play")).toBeVisible();
  // A sweep plays from one frequency to the other
  await area(page).getByLabel("Sweep from one frequency to another").check();
  await area(page).locator('input[name="from"]').fill("200");
  await area(page).locator('input[name="to"]').fill("800");
  await area(page).locator('input[name="dur"]').fill("2");
  await area(page).locator('input[name="dur"]').press("Enter");
  await btn(page, "Play the sweep").click();
  await page.waitForTimeout(1000);
  const mid = Number(
    await area(page).locator(".mt-tone-read").getAttribute("data-freq"),
  );
  expect(mid).toBeGreaterThan(250);
  expect(mid).toBeLessThan(700);
  await expect(btn(page, "Play the sweep")).toBeVisible({ timeout: 5000 });
});

test("drone: a sustained note with fifth and octave", async ({ page }) => {
  await openTool(page, "/drone");
  await area(page)
    .getByRole("group", { name: "Note" })
    .getByRole("button", { name: "A", exact: true })
    .click();
  await area(page)
    .getByRole("group", { name: "Octave" })
    .getByRole("button", { name: "3" })
    .click();
  const drone = area(page).locator(".mt-drone");
  await expect(drone).toHaveAttribute("data-note", "A3");
  await expect(drone).toHaveAttribute("data-freq", "220.000");
  await area(page).getByLabel("Add the fifth").check();
  await btn(page, "Play").click();
  const freqs = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          kmraMusic: { drone: { voices: { oscs: OscillatorNode[] }[] } };
        }
      ).kmraMusic.drone.voices.map((v) => v.oscs[0]!.frequency.value),
    );
  await expect.poll(freqs).toHaveLength(2);
  const [root, fifth] = await freqs();
  expect(root).toBeCloseTo(220, 3);
  expect(fifth).toBeCloseTo(329.628, 2);
  await btn(page, "Stop").click();
  await expect(btn(page, "Play")).toBeVisible();
});

/** Every sounding string of a diagram plays a chord tone */
async function checkDiagram(page: Page, strings: number[], notes: string) {
  const code = (await area(page)
    .locator(".mt-chord-svg")
    .getAttribute("data-frets"))!;
  const frets = [...code.matchAll(/\((\d+)\)|x|\d/g)].map((m) =>
    m[0] === "x" ? -1 : Number(m[1] ?? m[0]),
  );
  expect(frets).toHaveLength(strings.length);
  const pcs: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const want = new Set(
    notes
      .split(" ")
      .map(
        (n) =>
          (pcs[n[0]!]! +
            (n.match(/#/g)?.length ?? 0) -
            (n.slice(1).match(/b/g)?.length ?? 0) +
            12) %
          12,
      ),
  );
  frets.forEach((f, s) => {
    if (f >= 0)
      expect(want.has((strings[s]! + f) % 12), `${code} string ${s}`).toBe(
        true,
      );
  });
  return code;
}

test("chords: C, Am7 and F♯dim spelled right, with playable diagrams", async ({
  page,
}) => {
  await openTool(page, "/chords");
  const guitar = [40, 45, 50, 55, 59, 64];
  const head = area(page).locator(".mt-chord");
  const root = (n: string) =>
    area(page)
      .getByRole("group", { name: "Root" })
      .getByRole("button", { name: n, exact: true })
      .click();
  const type = (n: string) =>
    area(page)
      .getByRole("group", { name: "Chord", exact: true })
      .getByRole("button", { name: n, exact: true })
      .click();

  await root("C");
  await type("C");
  await expect(head).toHaveAttribute("data-notes", "C E G");
  expect(await checkDiagram(page, guitar, "C E G")).toBe("x32010");

  await root("A");
  await type("Am7");
  await expect(head).toHaveAttribute("data-notes", "A C E G");
  expect(await checkDiagram(page, guitar, "A C E G")).toBe("x02010");
  await expect(area(page).locator(".mt-notes li")).toHaveText([
    "A1",
    "C♭3",
    "E5",
    "G♭7",
  ]);

  await root("F♯");
  await type("F♯dim");
  await expect(head).toHaveAttribute("data-notes", "F# A C");
  await expect(area(page).locator(".mt-chord-symbol")).toHaveText("F♯dim");
  const first = await checkDiagram(page, guitar, "F# A C");
  await btn(page, "Next shape").click();
  const second = await checkDiagram(page, guitar, "F# A C");
  expect(second).not.toBe(first);
  await btn(page, "Strum").click();

  // Bass: root, fifth and octave
  await area(page)
    .getByRole("group", { name: "Instrument" })
    .getByRole("button", { name: "Bass" })
    .click();
  await root("C");
  await type("C");
  expect(await checkDiagram(page, [28, 33, 38, 43], "C E G")).toBe("x355");
});

test("scales: A minor pentatonic and D dorian on the fretboard and piano", async ({
  page,
}) => {
  await openTool(page, "/scales");
  const sc = area(page).locator(".mt-scale");
  const key = (n: string) =>
    area(page)
      .getByRole("group", { name: "Root" })
      .getByRole("button", { name: n, exact: true })
      .click();
  await key("A");
  await area(page)
    .getByLabel("Scale", { exact: true })
    .selectOption("minor-pentatonic");
  await expect(sc).toHaveAttribute("data-notes", "A C D E G");
  await expect(area(page).locator(".mt-scale-title")).toHaveText(
    "A minor pentatonic",
  );
  // Every dot on the fretboard is a scale note; the A on the 5th fret of the low E is a root
  const strings = [40, 45, 50, 55, 59, 64];
  const dots = await area(page)
    .locator(".mt-fb-dot")
    .evaluateAll((els) =>
      els.map(
        (e) =>
          [
            Number(e.getAttribute("data-string")),
            Number(e.getAttribute("data-fret")),
            e.classList.contains("root"),
          ] as const,
      ),
    );
  expect(dots.length).toBeGreaterThan(30);
  for (const [s, f, root] of dots) {
    const pc = (strings[s]! + f) % 12;
    expect([9, 0, 2, 4, 7]).toContain(pc);
    expect(root).toBe(pc === 9);
  }
  expect(dots.some(([s, f, r]) => s === 0 && f === 5 && r)).toBe(true);

  await key("D");
  await area(page).getByLabel("Scale", { exact: true }).selectOption("dorian");
  await expect(sc).toHaveAttribute("data-notes", "D E F G A B C");
  await area(page)
    .getByRole("group", { name: "Labels" })
    .getByRole("button", { name: "Degrees" })
    .click();
  await expect(area(page).locator(".mt-fb-dot.root text").first()).toHaveText(
    "1",
  );
  await expect(
    area(page).locator(".mt-fb-dot text", { hasText: "♭3" }).first(),
  ).toBeVisible();

  await area(page)
    .getByRole("group", { name: "Show on" })
    .getByRole("button", { name: "Piano" })
    .click();
  const keys = await area(page)
    .locator(".mt-key.in")
    .evaluateAll((els) =>
      els.map((e) => Number(e.getAttribute("data-midi")) % 12),
    );
  expect(new Set(keys)).toEqual(new Set([2, 4, 5, 7, 9, 11, 0]));
  await btn(page, "Play up").click();
  await expect(area(page).locator(".mt-key.on")).toHaveCount(1);
});

test("ear trainer: a right answer scores, a wrong one breaks the streak", async ({
  page,
}) => {
  await openTool(page, "/ear-trainer");
  const ear = area(page).locator(".mt-ear");
  const labels: Record<string, string> = {
    M2: "Major 2nd",
    m3: "Minor 3rd",
    M3: "Major 3rd",
    P4: "Perfect 4th",
    P5: "Perfect 5th",
    P8: "Octave",
  };
  await btn(page, "Start").click();
  const answer = (await ear.getAttribute("data-answer"))!;
  expect(Object.keys(labels)).toContain(answer);
  await area(page)
    .locator(".mt-answers")
    .getByRole("button", { name: labels[answer]! })
    .click();
  await expect(area(page).locator('[data-id="score"] dd')).toHaveText("1/1");
  await expect(area(page).locator('[data-id="streak"] dd')).toHaveText("1");
  await expect(area(page).locator(".mt-ear-prompt")).toHaveText(
    `Right: ${labels[answer]}`,
  );

  await btn(page, "Next").click();
  const next = (await ear.getAttribute("data-answer"))!;
  const wrong = Object.keys(labels).find((k) => k !== next)!;
  await area(page)
    .locator(".mt-answers")
    .getByRole("button", { name: labels[wrong]! })
    .click();
  await expect(area(page).locator('[data-id="score"] dd')).toHaveText("1/2");
  await expect(area(page).locator('[data-id="streak"] dd')).toHaveText("0");
  await expect(area(page).locator(".mt-answer.right")).toHaveText(
    new RegExp(labels[next]!),
  );
  // The miss is remembered (and weighted up) in this browser
  const weights = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kmra-music-ear") ?? "{}"),
  );
  expect(weights.intervals[next]).toBeGreaterThan(1);

  // Chords mode, answered with the number keys
  await area(page)
    .getByRole("group", { name: "Practise" })
    .getByRole("button", { name: "Chords" })
    .click();
  await btn(page, "Start").click();
  const chordAnswer = (await ear.getAttribute("data-answer"))!;
  await page.locator("h1").click();
  await page.keyboard.press(chordAnswer === "maj" ? "1" : "2");
  await expect(area(page).locator('[data-id="score"] dd')).toHaveText("2/3");
});

test("tuner: Start without a microphone explains what to do", async ({
  page,
}) => {
  await openTool(page, "/tuner");
  await btn(page, "Start").click();
  const tuner = area(page).locator(".mt-tuner");
  await expect(tuner).toHaveAttribute("data-state", /denied|nomic|busy|other/);
  await expect(area(page).locator(".mt-tuner-advice")).toContainText(
    /press Start again/i,
  );
  // Instrument and tuning lists
  await area(page)
    .getByLabel("Instrument", { exact: true })
    .selectOption("bass");
  await area(page)
    .getByLabel("Tuning", { exact: true })
    .selectOption("5-string");
  await expect(area(page).locator(".mt-string strong")).toHaveText([
    "B",
    "E",
    "A",
    "D",
    "G",
  ]);
  await area(page)
    .getByLabel("Instrument", { exact: true })
    .selectOption("ukulele");
  await area(page)
    .getByLabel("Tuning", { exact: true })
    .selectOption("baritone");
  await expect(area(page).locator(".mt-note")).toHaveText("D3 · G3 · B3 · E4");
  await btn(page, "Play D3").click();
});

test("home: the hero metronome runs and the tuner is one click away", async ({
  page,
}) => {
  await page.goto("/");
  const mini = page.locator(".mt-mini");
  await mini.getByRole("button", { name: "Faster" }).click();
  await expect(mini.locator(".mt-mini-bpm")).toHaveAttribute(
    "data-value",
    "100",
  );
  await mini.getByRole("button", { name: "Start the metronome" }).click();
  await expect(mini.locator(".mt-mini-dots span.on")).toHaveCount(1);
  await mini.getByRole("button", { name: "Stop" }).click();
  await mini.getByRole("link", { name: "Open the tuner" }).click();
  await expect(page).toHaveURL(/\/tuner$/);
});

const presets: [string, (p: Page) => Promise<void>][] = [
  ...(
    [
      ["guitar-tuner", "guitar", "standard", "E2 · A2 · D3 · G3 · B3 · E4"],
      ["ukulele-tuner", "ukulele", "standard", "G4 · C4 · E4 · A4"],
      ["bass-tuner", "bass", "4-string", "E1 · A1 · D2 · G2"],
      ["violin-tuner", "violin", null, "G3 · D4 · A4 · E5"],
      ["cello-tuner", "cello", null, "C2 · G2 · D3 · A3"],
      ["drop-d-tuning", "guitar", "drop-d", "D2 · A2 · D3 · G3 · B3 · E4"],
    ] as const
  ).map(
    ([slug, inst, tuning, strings]) =>
      [
        slug,
        async (p: Page) => {
          await expect(
            area(p).getByLabel("Instrument", { exact: true }),
          ).toHaveValue(inst);
          if (tuning)
            await expect(
              area(p).getByLabel("Tuning", { exact: true }),
            ).toHaveValue(tuning);
          await expect(area(p).locator(".mt-note")).toHaveText(strings);
        },
      ] as [string, (p: Page) => Promise<void>],
  ),
  [
    "practice-metronome",
    async (p) => {
      await expect(area(p).locator(".mt-bpm")).toHaveAttribute(
        "data-value",
        "60",
      );
      await expect(area(p).locator(".mt-dot")).toHaveCount(4);
    },
  ],
  [
    "6-8-metronome",
    async (p) => {
      await expect(area(p).locator(".mt-sig")).toHaveText("6/8");
      expect(
        await area(p)
          .locator(".mt-dot")
          .evaluateAll((d) => d.map((x) => x.getAttribute("data-level"))),
      ).toEqual(["accent", "normal", "normal", "accent", "normal", "normal"]);
    },
  ],
  [
    "440-hz-tone",
    async (p) => {
      await expect(area(p).locator('input[name="freq"]')).toHaveValue("440");
      await expect(area(p).locator(".mt-tone-note")).toContainText("A4");
    },
  ],
  ...(
    [
      ["hip-hop-beat-maker", "Hip-hop", "90"],
      ["trap-beat-maker", "Trap", "140"],
      ["house-beat-maker", "House", "124"],
      ["lofi-beat-maker", "Lo-fi", "80"],
      ["rock-drum-beat", "Rock", "110"],
      ["reggaeton-beat", "Reggaeton", "95"],
    ] as const
  ).map(
    ([slug, pattern, tempo]) =>
      [
        slug,
        async (p: Page) => {
          await expect(
            area(p)
              .getByRole("group", { name: "Starter patterns" })
              .getByRole("button", { name: pattern }),
          ).toHaveAttribute("aria-pressed", "true");
          await expect(area(p).locator(".mt-beat-bpm")).toHaveAttribute(
            "data-value",
            tempo,
          );
          await expect(
            area(p).locator('.mt-cell[data-drum="kick"][data-step="0"]'),
          ).toHaveAttribute("data-v", "2");
        },
      ] as [string, (p: Page) => Promise<void>],
  ),
  [
    "ukulele-chords",
    async (p) => {
      await expect(
        area(p)
          .getByRole("group", { name: "Instrument" })
          .getByRole("button", { name: "Ukulele" }),
      ).toHaveAttribute("aria-pressed", "true");
      const code = await area(p)
        .locator(".mt-chord-svg")
        .getAttribute("data-frets");
      expect(code).toHaveLength(4);
      expect(code).toBe("0003");
    },
  ],
];

for (const [slug, check] of presets)
  test(`use case ${slug} applies its preset`, async ({ page }) => {
    await openTool(page, `/${slug}`);
    await check(page);
  });

test("every use case has a preset test", () => {
  expect(app.tasks.map((t) => t.slug).sort()).toEqual(
    presets.map(([s]) => s).sort(),
  );
});

test("Bangla pages are translated", async ({ page }) => {
  await openTool(page, "/bn/metronome");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1")).toHaveText("অনলাইন মেট্রোনোম");
  await expect(area(page).locator(".mt-bpm output")).toHaveText("১০০");
  await expect(btn(page, "শুরু")).toBeVisible();
  await expect(
    area(page).getByRole("group", { name: "টাইম সিগনেচার" }),
  ).toBeVisible();
  await openTool(page, "/bn/tuner");
  await expect(area(page).locator(".mt-tuner-advice")).toContainText(
    "মাইক্রোফোন",
  );
  await page.goto("/bn");
  await expect(page.locator("h1")).toHaveText(
    "টিউন করুন, তাল রাখুন, অনুশীলন করুন",
  );
  await expect(page.getByRole("link", { name: "টিউনার খুলুন" })).toBeVisible();
});

test('visitors don\'t get the test hooks; one tool reads "1 tool"', async ({
  browser,
}, info) => {
  // A plain page, without the test fixture that switches the hooks on
  const page = await browser.newPage();
  const base = info.project.use.baseURL!;
  await page.goto(`${base}/metronome`);
  await page.locator(".tool-area").waitFor();
  await page
    .getByRole("button", { name: "Start", exact: true })
    .first()
    .click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => "kmraMusic" in window)).toBe(false);
  await page.goto(`${base}/tools`);
  await expect(page.locator("#tune .sechead p")).toHaveText("1 tool");
  await expect(page.locator("#rhythm .sechead p")).toHaveText("3 tools");
  await page.close();
});

test("every ready tool has a test above", () => {
  const tested = new Set([
    "tuner",
    "metronome",
    "tap-tempo",
    "tone-generator",
    "drone",
    "chords",
    "scales",
    "ear-trainer",
    // tests/musictool/beat-maker.spec.ts
    "beat-maker",
  ]);
  const missing = app.tools.filter((t) => t.ready && !tested.has(t.slug));
  expect(missing.map((t) => t.slug)).toEqual([]);
});

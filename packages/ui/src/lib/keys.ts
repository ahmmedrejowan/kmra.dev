/**
 * Keyboard shortcuts that read right on every OS: "mod" is ⌘ on Apple devices and Ctrl elsewhere.
 * Shortcut strings look like "mod+K", "mod+shift+S", "?" or "ArrowLeft".
 */
export function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return (
    /mac|iphone|ipad|ipod/i.test(platform) ||
    /Mac OS X|iPhone|iPad/.test(navigator.userAgent)
  );
}

/** Phones and tablets without a keyboard: shortcut hints are hidden there. */
export function isTouch(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

/** "or paste with ⌘V. Nothing is uploaded." on desktop, "Nothing is uploaded." on touch devices. */
export function pasteHint(): string {
  return isTouch()
    ? "Nothing is uploaded."
    : `or paste with ${formatKeys("mod+V")}. Nothing is uploaded.`;
}

const NAMES: Record<string, [apple: string, other: string]> = {
  mod: ["⌘", "Ctrl"],
  shift: ["⇧", "Shift"],
  alt: ["⌥", "Alt"],
  arrowleft: ["←", "←"],
  arrowright: ["→", "→"],
  escape: ["Esc", "Esc"],
  delete: ["⌫", "Delete"],
};

/** Split "mod+shift+S" into parts; a literal "+" key ("+" or "mod++") is kept as a part. */
function split(combo: string): string[] {
  if (combo === "+") return ["+"];
  if (combo.endsWith("++")) return [...combo.slice(0, -2).split("+"), "+"];
  return combo.split("+");
}

/** "mod+shift+S" → "⌘⇧S" on Apple, "Ctrl+Shift+S" elsewhere. */
export function formatKeys(combo: string, apple = isApple()): string {
  const parts = split(combo).map((p) => {
    const named = NAMES[p.toLowerCase()];
    return named ? named[apple ? 0 : 1] : p.length === 1 ? p.toUpperCase() : p;
  });
  return apple ? parts.join("") : parts.join("+");
}

/** Does this keyboard event match the combo? */
export function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = split(combo.toLowerCase());
  const key = parts[parts.length - 1]!;
  const mod = parts.includes("mod");
  const shift = parts.includes("shift");
  const alt = parts.includes("alt");
  const modDown = isApple() ? e.metaKey : e.ctrlKey;
  if (mod !== modDown || alt !== e.altKey) return false;
  // Shifted symbols like "?" or "+" carry shift implicitly
  if (key.length > 1 || /[a-z0-9]/.test(key)) {
    if (shift !== e.shiftKey) return false;
  }
  return e.key.toLowerCase() === key;
}

/** True when focus is in a text field, where single-key shortcuts must not fire. */
export function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLInputElement)
    return !["range", "checkbox", "radio", "button"].includes(t.type);
  return t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Anywhere",
    items: [
      { keys: ["mod+K", "/"], label: "Search tools" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
      { keys: ["mod+V"], label: "Paste an image" },
    ],
  },
  {
    title: "In a tool",
    items: [
      { keys: ["mod+O"], label: "Choose images" },
      { keys: ["mod+S"], label: "Download (zip when there are several files)" },
      { keys: ["mod+shift+S"], label: "Save each file separately" },
      { keys: ["ArrowLeft", "ArrowRight"], label: "Previous / next file" },
      { keys: ["+", "-"], label: "Zoom in / out" },
      { keys: ["0"], label: "Fit to view" },
      { keys: ["1"], label: "Actual size (100%)" },
      { keys: ["A"], label: "Switch Simple / Advanced" },
      { keys: ["Escape"], label: "Close the Advanced workspace" },
    ],
  },
];

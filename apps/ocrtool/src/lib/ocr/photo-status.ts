/**
 * Every English string the photo engine reports (progress status and error messages). The UI
 * shows them through T(); their Bangla is in packages/ui/src/i18n/bn-ocrtool.ts
 * (`// -- photo engine --`).
 */
export const PHOTO_STATUS = {
  download: "Downloading the photo engine (first time only)",
  load: "Loading the photo engine",
  find: "Finding lines of text",
  read: "Reading the lines",
  loadFailed:
    "The photo engine couldn't load. Check your connection and try again.",
  failed: "The photo engine couldn't read this image.",
  noLangs:
    "The photo engine doesn't read the chosen languages. Use the document engine.",
} as const;

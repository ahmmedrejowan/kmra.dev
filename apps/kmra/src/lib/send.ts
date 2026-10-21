/**
 * Hand files to another kmra app: its /handoff page (in a hidden frame; only kmra.dev may frame
 * it) keeps them in that app's own storage, and the tool takes them when it opens. The files go
 * from this tab's memory to the other site's storage in the same browser; nothing is uploaded.
 * Resolves false when the app didn't confirm in time (the tool then opens empty).
 */
export function sendFiles(files: File[], toolUrl: string): Promise<boolean> {
  const origin = new URL(toolUrl).origin;
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Handoff";
  frame.src = `${origin}/handoff`;
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
      resolve(ok);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.contentWindow) return;
      if (e.data?.type === "kmra:ready")
        frame.contentWindow!.postMessage({ type: "kmra:files", files, to: toolUrl }, origin);
      else if (e.data?.type === "kmra:stored") done(e.data.ok === true);
    };
    const timer = setTimeout(() => done(false), 10_000);
    addEventListener("message", onMessage);
    document.body.appendChild(frame);
  });
}

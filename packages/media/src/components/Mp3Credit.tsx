import { useT } from "@kmra/ui/lib/i18n-react";

/**
 * Credit for the MP3 encoder, shown wherever MP3 is the chosen output. Both engines encode MP3
 * with LAME (Mediabunny's WebAssembly build, or ffmpeg's libmp3lame), and LAME's licence page
 * asks for a mention with a link. The licences are in each app's /NOTICE-mp3.txt.
 */
export function Mp3Credit() {
  const T = useT();
  return (
    <p className="muted mp3-credit">
      {T("MP3s are made with the")}{" "}
      <a href="https://lame.sourceforge.io/" target="_blank" rel="noopener noreferrer">
        {T("LAME encoder")}
      </a>
      .
    </p>
  );
}

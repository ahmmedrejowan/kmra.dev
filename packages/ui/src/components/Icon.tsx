import { ICONS, type IconKey } from "../lib/icons";

export function Icon({
  name,
  className = "ico",
}: {
  name: IconKey;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Field,
  How,
  Row,
  save,
  store,
  useFmt,
} from "../lib/ui";
import {
  allZones,
  cityName,
  instant,
  localZone,
  offsetLabel,
  offsetMin,
  region,
  wall,
  zoneAbbr,
} from "../lib/tz";
import { iso, parseDate } from "../lib/dates";
import { parseClock } from "../lib/time";
import { intlLocale } from "../lib/num";

const KEY = "kmra-calc-zones";
const DEFAULT = [
  "America/New_York",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function nowParts() {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return {
    date: iso({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }),
    time: `${pad(n.getHours())}:${pad(n.getMinutes())}`,
  };
}

/** A zone picker grouped by region */
function ZoneSelect({
  id,
  value,
  zones,
  onPick,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  zones: string[];
  onPick: (z: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const z of zones) {
      const r = region(z) || "UTC";
      if (!m.has(r)) m.set(r, []);
      m.get(r)!.push(z);
    }
    for (const list of m.values())
      list.sort((a, b) => cityName(a).localeCompare(cityName(b)));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [zones]);
  return (
    <select
      id={id}
      className="calc-control"
      value={value}
      aria-label={label}
      onChange={(e) => e.target.value && onPick(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {groups.map(([r, list]) => (
        <optgroup key={r} label={r}>
          {list.map((z) => (
            <option key={z} value={z}>
              {cityName(z)}
              {z.split("/").length > 2
                ? ` (${z.split("/")[1]!.replace(/_/g, " ")})`
                : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function TimeZones(_: ToolProps) {
  const T = useT();
  const f = useFmt();
  const lang = useLang();
  // The browser's own zone can be an old alias (Asia/Calcutta) missing from the list
  const zones = useMemo(() => {
    const z = allZones();
    const here = localZone();
    return z.includes(here) ? z : [here, ...z];
  }, []);
  const [from, setFrom] = useState(localZone);
  const [{ date, time }, setWhen] = useState(nowParts);
  const [cities, setCities] = useState<string[]>(DEFAULT);
  const [h12, setH12] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = store<string[] | null>(KEY, null);
    if (saved?.length) setCities(saved.filter((z) => zones.includes(z)));
  }, [zones]);
  const setList = (l: string[]) => {
    setCities(l);
    save(KEY, l);
  };

  const d = parseDate(date);
  const c = parseClock(time);
  const t =
    d && c !== null
      ? instant(from, d.y, d.m, d.d, Math.floor(c / 60), c % 60)
      : null;
  const fromOff = t !== null ? offsetMin(from, t) : 0;
  const shown = [from, ...cities.filter((z) => z !== from)];

  const fmtTime = (z: string, at: number) =>
    new Intl.DateTimeFormat(intlLocale(lang), {
      timeZone: z,
      hour: "numeric",
      minute: "2-digit",
      ...(h12 === null ? {} : { hour12: h12 }),
    }).format(at);
  const fmtDay = (z: string, at: number) =>
    new Intl.DateTimeFormat(intlLocale(lang), {
      timeZone: z,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(at);

  const fromDay = t !== null ? wall(from, t) : null;

  return (
    <CalcCard
      bar={
        <Choice
          label={T("Clock")}
          hideLabel
          value={h12 === null ? "auto" : h12 ? "12" : "24"}
          onPick={(v) => setH12(v === "auto" ? null : v === "12")}
          options={[
            ["auto", T("Usual for my language")],
            ["12", T("12-hour")],
            ["24", T("24-hour")],
          ]}
        />
      }
      result={
        t === null ? (
          <p className="calc-wait">{T("Pick a date and a time.")}</p>
        ) : (
          <ol className="calc-zones" aria-label={T("Times")}>
            {shown.map((z) => {
              const w = wall(z, t);
              const off = offsetMin(z, t);
              const diff = off - fromOff;
              const dayShift =
                fromDay &&
                (w.y !== fromDay.y || w.m !== fromDay.m || w.d !== fromDay.d)
                  ? Date.UTC(w.y, w.m - 1, w.d) >
                    Date.UTC(fromDay.y, fromDay.m - 1, fromDay.d)
                    ? T("Next day")
                    : T("Previous day")
                  : null;
              const abbr = zoneAbbr(z, t, intlLocale(lang));
              return (
                <li
                  key={z}
                  className={`calc-zone${w.h < 7 || w.h >= 21 ? " night" : ""}`}
                  data-zone={z}
                >
                  <span className="calc-zone-name">
                    {z === from ? `${cityName(z)} · ${T("From")}` : cityName(z)}
                    <span className="calc-zone-meta">
                      {f.d(offsetLabel(off))}
                      {abbr && !abbr.startsWith("GMT") && abbr !== "UTC"
                        ? ` · ${abbr}`
                        : ""}
                      {z !== from &&
                        ` · ${
                          diff === 0
                            ? T("same time")
                            : T("{d} h", {
                                d: `${diff > 0 ? "+" : "−"}${f.n(Math.abs(diff) / 60, 2)}`,
                              })
                        }`}
                    </span>
                  </span>
                  <span
                    className="calc-zone-time"
                    data-value={`${String(w.h).padStart(2, "0")}:${String(w.min).padStart(2, "0")}`}
                    data-date={iso(w)}
                  >
                    {fmtTime(z, t)}
                    <span
                      className={`calc-zone-day${dayShift ? " shift" : ""}`}
                    >
                      {dayShift
                        ? `${fmtDay(z, t)} · ${dayShift}`
                        : fmtDay(z, t)}
                    </span>
                  </span>
                  {z === from ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      className="calc-iconbtn"
                      aria-label={T("Remove {city}", { city: cityName(z) })}
                      title={T("Remove")}
                      onClick={() => setList(cities.filter((x) => x !== z))}
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )
      }
      below={
        <How title={T("Good to know")}>
          <p>
            {T(
              "Times come from your browser's own time zone data, so daylight saving changes are included for the date you pick.",
            )}
          </p>
        </How>
      }
    >
      <Row>
        <Field label={T("Date")} htmlFor="calc-date">
          <input
            id="calc-date"
            name="date"
            type="date"
            className="calc-control"
            value={date}
            onChange={(e) => setWhen({ date: e.target.value, time })}
          />
        </Field>
        <Field label={T("Time")} htmlFor="calc-time">
          <input
            id="calc-time"
            name="time"
            type="time"
            className="calc-control"
            value={time}
            onChange={(e) => setWhen({ date, time: e.target.value })}
          />
        </Field>
      </Row>
      <button
        type="button"
        className="btn sm calc-add"
        onClick={() => setWhen(nowParts())}
      >
        <Icon name="clock" />
        {T("Now")}
      </button>
      <Field label={T("In this time zone")} htmlFor="calc-from">
        <ZoneSelect
          id="calc-from"
          value={from}
          zones={zones}
          onPick={setFrom}
        />
      </Field>
      <Field label={T("Add a city")} htmlFor="calc-addzone">
        <ZoneSelect
          id="calc-addzone"
          value=""
          zones={zones.filter((z) => z !== from && !cities.includes(z))}
          placeholder={T("Pick a city or time zone")}
          onPick={(z) => setList([...cities, z])}
        />
      </Field>
    </CalcCard>
  );
}

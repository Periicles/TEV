import { ringArcs } from "@/lib/ring-chart";

/** Number of `--chart-*` colors in globals.css; further categories reuse them. */
const PALETTE_SIZE = 8;
const RADIUS = 40;
const STROKE = 7;

export interface RingItem {
  key: string;
  label: string;
  value: number;
  /** Formatted amount and share, shown in the legend. */
  amount: string;
  percent: string;
  /** Index in the chart palette, the same on every trip; `null` for grey (no category). */
  colorIndex: number | null;
}

/** Shares as glowing arcs on a ring, with a legend. Rendered on the server, without JavaScript. */
export function CategoryRing({ id, items }: { id: string; items: RingItem[] }) {
  const arcs = ringArcs(
    items.map((item) => item.value),
    { radius: RADIUS, strokeWidth: STROKE, gap: 5 },
  );
  const colors = items.map((item) =>
    item.colorIndex === null
      ? "var(--muted-foreground)"
      : `var(--chart-${(item.colorIndex % PALETTE_SIZE) + 1})`,
  );
  // Next keeps visited pages in the DOM: the filter id must differ from one trip to another.
  const glow = `glow-${id}`;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <svg
        viewBox="-50 -50 100 100"
        className="size-36 shrink-0 overflow-visible"
        // The legend carries the same information as text.
        aria-hidden
      >
        <defs>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="rotate(-90)" filter={`url(#${glow})`} fill="none" strokeWidth={STROKE}>
          {arcs.map((arc, index) => (
            <circle
              key={items[index].key}
              r={RADIUS}
              stroke={colors[index]}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap={arc.full ? "butt" : "round"}
            />
          ))}
        </g>
      </svg>
      <ul className="grid w-full gap-2 text-sm sm:max-w-sm">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-4 tabular-nums"
            data-testid={`category-${item.label}`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: colors[index],
                  boxShadow: `0 0 6px ${colors[index]}`,
                }}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0">
              {item.amount} <span className="text-muted-foreground">· {item.percent}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

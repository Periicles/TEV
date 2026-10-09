/**
 * Arcs of a ring chart drawn as dashes on an SVG circle: each value gets an arc proportional to its
 * share, clockwise in the order of `values`, separated by `gap` (in the circle's units). Round line
 * caps stick out of each end by half the stroke width, so the dash is shortened to keep the gap.
 */
export interface RingArc {
  dashArray: string;
  dashOffset: number;
  /** Whether the arc is the whole ring (a single value), drawn without caps or gap. */
  full: boolean;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4 || 0;

export function ringArcs(
  values: number[],
  { radius, strokeWidth, gap }: { radius: number; strokeWidth: number; gap: number },
): RingArc[] {
  const positive = values.map((v) => Math.max(v, 0));
  const total = positive.reduce((sum, v) => sum + v, 0);
  const circumference = 2 * Math.PI * radius;
  const shown = positive.filter((v) => v > 0).length;
  let start = 0;
  return positive.map((value) => {
    const length = total > 0 ? (value / total) * circumference : 0;
    const arc: RingArc =
      shown === 1 && value > 0
        ? { dashArray: `${round(circumference)} 0`, dashOffset: 0, full: true }
        : {
            // A tiny share still shows as a dot; an empty one shows nothing.
            dashArray: `${value > 0 ? round(Math.max(length - gap - strokeWidth, 0.001)) : 0} ${round(circumference)}`,
            dashOffset: round(-(start + (gap + strokeWidth) / 2)),
            full: false,
          };
    start += length;
    return arc;
  });
}

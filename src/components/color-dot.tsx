import { cn } from "@/lib/utils";

/** A small round swatch that glows in its own color, like a neon light. */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}, 0 0 10px ${color}` }}
      aria-hidden
    />
  );
}

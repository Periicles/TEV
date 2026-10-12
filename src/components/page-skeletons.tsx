/**
 * Placeholders shaped like each page, shown by the routes' `loading.tsx` while the page loads.
 * Static on purpose: no translations (the language comes from a cookie, which would make these
 * fallbacks dynamic), so screen readers get `aria-busy` instead of text.
 */
import { Skeleton } from "@/components/ui/skeleton";

/** The trips list: a title with its buttons, then trip cards. */
export function TripsSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 lg:max-w-6xl"
      aria-busy="true"
      data-testid="skeleton"
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3 rounded-xl border p-6">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
    </main>
  );
}

/** A trip: header, then the summary column and the expense list. */
export function TripSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-28 lg:max-w-6xl lg:gap-8 lg:pb-12"
      aria-busy="true"
      data-testid="skeleton"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="grid content-start gap-6">
          <div className="grid gap-3 rounded-xl border p-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="size-32 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <Skeleton className="h-5 w-24" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

/** A form page (trip, expense, import, categories): a title, then labelled fields. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <main
      className="mx-auto w-full max-w-lg flex-1 px-4 py-8"
      aria-busy="true"
      data-testid="skeleton"
    >
      <Skeleton className="mb-6 h-8 w-52" />
      <div className="grid gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    </main>
  );
}

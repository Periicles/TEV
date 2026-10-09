/**
 * Shown while a page loads. Static on purpose (no translations: the language comes from a cookie,
 * which would make this fallback dynamic): blocks shaped like a title and content.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 lg:max-w-6xl"
      aria-busy="true"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3">
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      </div>
    </main>
  );
}

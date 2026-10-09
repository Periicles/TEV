/** A centred message for error and not-found pages, with its actions. */
export function StatusPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>
    </main>
  );
}

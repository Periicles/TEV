import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";

export default async function Home() {
  const [session, t] = await Promise.all([requireSession(), getTranslations("home")]);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-2 px-4 py-16">
      <h1 className="text-3xl font-semibold">{t("greeting", { name: session.user.name })}</h1>
      <p className="text-muted-foreground">{t("tagline")}</p>
    </main>
  );
}

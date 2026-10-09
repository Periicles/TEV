import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("app");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-2 px-4 py-16">
      <h1 className="text-3xl font-semibold">{t("name")}</h1>
      <p className="text-muted-foreground">{t("tagline")}</p>
    </main>
  );
}

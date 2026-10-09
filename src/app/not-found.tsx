import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("status");
  return (
    <StatusPage title={t("notFoundTitle")} description={t("notFoundDescription")}>
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </StatusPage>
  );
}

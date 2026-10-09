"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("status");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title={t("errorTitle")}
      description={
        error.digest
          ? `${t("errorDescription")} ${t("errorReference", { digest: error.digest })}`
          : t("errorDescription")
      }
    >
      <Button onClick={() => retry()}>{t("retry")}</Button>
      <Button asChild variant="outline">
        <Link href="/">{t("home")}</Link>
      </Button>
    </StatusPage>
  );
}

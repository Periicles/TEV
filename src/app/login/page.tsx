import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <LoginForm />
    </main>
  );
}

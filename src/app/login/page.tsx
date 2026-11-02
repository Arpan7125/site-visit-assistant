import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button, ErrorNote, inputClass } from "@/components/ui";
import { currentStaff } from "@/lib/authz";

export const metadata: Metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  if (await currentStaff()) redirect("/admin/leads");
  const target = next?.startsWith("/admin") ? next : "/admin/leads";

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: target,
      });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=1&next=${encodeURIComponent(target)}`);
      throw e;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        Company A, Ahmedabad
      </Link>
      <h1 className="mb-8 mt-4 font-display text-4xl font-light">Sales team sign in</h1>
      {error && (
        <div className="mb-5">
          <ErrorNote title="That email and password don't match an active account." />
        </div>
      )}
      <form action={login} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Work email
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">Demo accounts are listed in deployment.md.</p>
    </main>
  );
}

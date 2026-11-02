import type { NextAuthConfig } from "next-auth";

export type StaffRole = "EXECUTIVE" | "SALES_HEAD";

/** Routes only the sales head may open. Everything else under /admin needs any staff login. */
export const HEAD_ONLY = [/^\/admin\/dashboard/, /^\/admin\/settings/, /^\/api\/admin\/(facts|slots|reviews|import|dashboard)/];

/** Edge-safe config shared by middleware and the full auth setup. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: StaffRole }).role;
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, { id: token.uid as string, role: token.role as StaffRole });
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

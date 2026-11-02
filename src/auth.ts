import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { logActivity } from "./lib/activity";
import { prisma } from "./lib/db";

const DUMMY_HASH = bcrypt.hashSync("no-such-user", 10);
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Compare against a dummy hash when the user is missing so timing does not reveal accounts.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !user.active || !ok) return null;
        await logActivity(prisma, { actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});

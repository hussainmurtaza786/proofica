import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

if (process.env.NODE_ENV === "production" && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) {
  throw new Error("AUTH_SECRET must be set to a secure random string in production. Run: npx auth secret");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: { memberships: { where: { status: "active" }, include: { org: true } } },
        });
        if (!user || !user.passwordHash) return null;
        if (!user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const activeMembership = user.memberships[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          orgId: activeMembership?.orgId ?? null,
          orgName: activeMembership?.org.name ?? null,
          role: activeMembership?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.orgId = user.orgId ?? null;
        token.orgName = user.orgName ?? null;
        token.role = user.role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.orgId = token.orgId as string | null;
        session.user.orgName = token.orgName as string | null;
        session.user.role = token.role as string | null;
      }
      return session;
    },
  },
});

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  orgId: string | null;
  orgName: string | null;
  role: string | null;
};

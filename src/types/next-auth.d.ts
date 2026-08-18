import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    orgId?: string | null;
    orgName?: string | null;
    role?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      orgId: string | null;
      orgName: string | null;
      role: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string | null;
    orgName?: string | null;
    role?: string | null;
  }
}

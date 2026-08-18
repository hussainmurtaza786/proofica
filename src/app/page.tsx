import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";

export default async function Home() {
  const session = await auth();
  redirect(session?.user?.id ? "/dashboard" : "/login");
}

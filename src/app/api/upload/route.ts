import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { getStorage, validateUpload, buildFileKey, verifyMagicBytes } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  // Verify active membership.
  const membership = await prisma.organizationMember.findFirst({
    where: { orgId, userId: session.user.id, status: "active" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = ((formData.get("folder") as string) || "uploads").replace(/[^a-zA-Z0-9_-]/g, "") || "uploads";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validationError = validateUpload({ type: file.type, size: file.size });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Verify magic bytes match claimed MIME type.
  if (!verifyMagicBytes(bytes, file.type)) {
    return NextResponse.json({ error: "File content does not match claimed type" }, { status: 400 });
  }

  const key = buildFileKey(orgId, folder, file.name);
  const storage = getStorage();
  const url = await storage.put(key, bytes, file.type);

  return NextResponse.json({ url, key });
}

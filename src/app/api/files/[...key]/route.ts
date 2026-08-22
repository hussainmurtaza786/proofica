import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth/auth";
import { resolveStoragePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const relative = key.join(path.sep);

  // Containment check: rejects traversal outside the storage root.
  const full = resolveStoragePath(relative);
  if (!full) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Verify the file belongs to the user's org.
  const fileOrgId = key[0];
  if (!fileOrgId || fileOrgId !== session.user.orgId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await readFile(full);
    const ext = path.extname(full);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeFor(ext),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function matchesFileSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (contentType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (contentType === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  return false;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.() -]/g, "_").slice(0, 200) || "payment-proof";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload payment proof." }, { status: 401 });
  if (!await consumeRateLimit(request, "recharge-proof", user.id, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PROOF_BYTES + 256_000) return NextResponse.json({ error: "Payment proof must be 5 MB or smaller." }, { status: 413 });

  const { id } = await params;
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Choose a valid payment proof file." }, { status: 400 }); }
  const file = form.get("proof");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a receipt or screenshot to upload." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PROOF_BYTES) return NextResponse.json({ error: "Payment proof must be between 1 byte and 5 MB." }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WebP, or PDF file." }, { status: 415 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(bytes, file.type)) return NextResponse.json({ error: "The file contents do not match the selected file type." }, { status: 415 });

  const uploadedAt = new Date();
  const fileName = safeFileName(file.name);
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.rechargeRequest.updateMany({
        where: { id, userId: user.id, status: "PENDING" },
        data: { proofData: bytes, proofContentType: file.type, proofFileName: fileName, proofUploadedAt: uploadedAt },
      });
      if (updated.count !== 1) throw new Error("NOT_PENDING_OR_OWNER");
      await recordAudit(tx, request, user.id, "recharge.proof_uploaded", "RechargeRequest", id, { contentType: file.type, bytes: file.size });
    });
    return NextResponse.json({ fileName, contentType: file.type, uploadedAt: uploadedAt.toISOString() }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_PENDING_OR_OWNER") return NextResponse.json({ error: "This recharge was not found, is not yours, or is no longer pending." }, { status: 409 });
    console.error(JSON.stringify({ event: "recharge_proof_upload_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Payment proof could not be saved." }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view payment proof." }, { status: 401 });
  const { id } = await params;
  const recharge = await prisma.rechargeRequest.findUnique({
    where: { id },
    select: { userId: true, assignedAgentId: true, proofData: true, proofContentType: true, proofFileName: true },
  });
  if (!recharge) return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });
  const allowed = user.role === "ADMIN" || (user.role === "AGENT" && recharge.assignedAgentId === user.id) || recharge.userId === user.id;
  if (!allowed) return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });
  if (!recharge.proofData || !recharge.proofContentType) return NextResponse.json({ error: "No payment proof has been uploaded." }, { status: 404 });
  return new NextResponse(recharge.proofData, { headers: {
    "Content-Type": recharge.proofContentType,
    "Content-Disposition": `inline; filename="${safeFileName(recharge.proofFileName ?? "payment-proof")}"`,
    "Content-Length": String(recharge.proofData.byteLength),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  } });
}

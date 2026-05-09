import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";
import { countSignaturesForSignatoryMember, deleteSignatoryMember } from "@/lib/sharepoint/signatories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can remove signatory members" }, { status: 403 });
    }

    const { id } = await params;

    const signatureCount = await countSignaturesForSignatoryMember(id);

    if (signatureCount > 0) {
      return NextResponse.json(
        { error: "Cannot remove a signatory who has already signed on a request." },
        { status: 400 },
      );
    }

    await deleteSignatoryMember(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting signatory member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

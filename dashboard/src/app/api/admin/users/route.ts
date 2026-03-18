import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readAllowedUsers, writeAllowedUsers, isAdmin } from "@/lib/allowed-users";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await checkAdmin();
  if (denied) return denied;

  const data = readAllowedUsers();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const denied = await checkAdmin();
  if (denied) return denied;

  const { email } = (await req.json()) as { email?: string };
  if (!email || !email.toLowerCase().endsWith("@zuid.com")) {
    return NextResponse.json({ error: "Alleen @zuid.com adressen zijn toegestaan" }, { status: 400 });
  }

  const data = readAllowedUsers();
  const normalized = email.toLowerCase();
  if (!data.allowedEmails.map((e) => e.toLowerCase()).includes(normalized)) {
    data.allowedEmails.push(email.toLowerCase());
    writeAllowedUsers(data);
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const denied = await checkAdmin();
  if (denied) return denied;

  const { email } = (await req.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Geen e-mail opgegeven" }, { status: 400 });
  }

  const normalized = email.toLowerCase();
  if (normalized === "ruben@zuid.com") {
    return NextResponse.json({ error: "Ruben kan niet worden verwijderd" }, { status: 400 });
  }

  const data = readAllowedUsers();
  data.allowedEmails = data.allowedEmails.filter(
    (e) => e.toLowerCase() !== normalized
  );
  writeAllowedUsers(data);

  return NextResponse.json(data);
}

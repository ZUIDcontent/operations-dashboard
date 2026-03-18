import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "data", "allowed-users.json");

export interface AllowedUsers {
  allowedEmails: string[];
}

export function readAllowedUsers(): AllowedUsers {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as AllowedUsers;
  } catch {
    return { allowedEmails: [] };
  }
}

export function writeAllowedUsers(data: AllowedUsers): void {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!email.toLowerCase().endsWith("@zuid.com")) return false;
  const { allowedEmails } = readAllowedUsers();
  return allowedEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === "ruben@zuid.com";
}

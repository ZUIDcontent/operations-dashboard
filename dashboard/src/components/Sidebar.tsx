"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ShieldCheck, ClipboardList, FileText, Link2, RefreshCw, LogOut, Users } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/financial", label: "Opdrachten", icon: BarChart3 },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/control", label: "Controle", icon: Link2 },
  { href: "/hygiene", label: "Hygiëne", icon: ShieldCheck },
  { href: "/pm-board", label: "PM Board", icon: ClipboardList },
];

interface SidebarProps {
  syncedAt: string | null;
  userEmail: string | null;
  userName: string | null;
  userImage: string | null;
}

export default function Sidebar({ syncedAt, userEmail, userName, userImage }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const isAdmin = userEmail?.toLowerCase() === "ruben@zuid.com";

  async function handleSync() {
    setSyncing(true);
    setSyncError(false);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        setSyncError(true);
      } else {
        router.refresh();
      }
    } catch {
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  }

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : userEmail?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="w-56 shrink-0 bg-gray-950 text-white flex flex-col min-h-screen">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-orange-500 tracking-tight">ZUID</h1>
        <p className="text-xs text-gray-400 mt-0.5">ClickUp Dashboards</p>
      </div>

      {/* Gebruiker + uitloggen */}
      {userEmail && (
        <div className="px-5 pb-3 flex items-center gap-2.5">
          {userImage ? (
            <img
              src={userImage}
              alt={userName ?? userEmail}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-[11px] font-bold text-orange-400">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-300 truncate">
              {userName ?? userEmail}
            </p>
            {userName && (
              <p className="text-[10px] text-gray-600 truncate">{userEmail}</p>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
            title="Uitloggen"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}

      {/* Data verversen */}
      <div className="px-3 pb-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            syncing
              ? "bg-white/5 text-gray-500 cursor-not-allowed"
              : syncError
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
          )}
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Bezig…" : syncError ? "Mislukt, probeer opnieuw" : "Data verversen"}
        </button>
        {syncedAt && (
          <p className="text-[11px] text-gray-500 mt-1.5 px-1">
            Laatste sync:{" "}
            {new Date(syncedAt).toLocaleString("nl-NL", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      <div className="mx-3 mb-3 border-t border-white/10" />

      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (pathname === "/" && href === "/financial");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                Beheer
              </p>
            </div>
            <Link
              href="/admin/users"
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === "/admin/users"
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Users size={18} />
              Gebruikers
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Users } from "lucide-react";

export default function AdminUsersPage() {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setEmails(data.allowedEmails);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newEmail.toLowerCase().endsWith("@zuid.com")) {
      setError("Alleen @zuid.com adressen zijn toegestaan.");
      return;
    }
    setAdding(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Er ging iets mis.");
    } else {
      setEmails(data.allowedEmails);
      setNewEmail("");
    }
    setAdding(false);
  }

  async function removeUser(email: string) {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setEmails(data.allowedEmails);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-500/15 rounded-lg">
          <Users size={20} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gebruikersbeheer</h1>
          <p className="text-sm text-gray-500">Beheer wie kan inloggen op de dashboards.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <form onSubmit={addUser} className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collega toevoegen
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="naam@zuid.com"
              required
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <UserPlus size={15} />
              {adding ? "Toevoegen…" : "Toevoegen"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>

        <ul className="divide-y divide-gray-100">
          {loading ? (
            <li className="px-4 py-3 text-sm text-gray-400">Laden…</li>
          ) : emails.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400">Geen gebruikers gevonden.</li>
          ) : (
            emails.map((email) => (
              <li key={email} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-500/15 flex items-center justify-center text-xs font-bold text-orange-500 uppercase">
                    {email[0]}
                  </div>
                  <span className="text-sm text-gray-800">{email}</span>
                  {email.toLowerCase() === "ruben@zuid.com" && (
                    <span className="text-[10px] font-medium bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                      admin
                    </span>
                  )}
                </div>
                {email.toLowerCase() !== "ruben@zuid.com" && (
                  <button
                    onClick={() => removeUser(email)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-xs text-gray-400">
        Alleen @zuid.com e-mailadressen kunnen worden toegevoegd. Wijzigingen gaan direct in.
      </p>
    </div>
  );
}

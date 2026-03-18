import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { loadCache } from "@/lib/data";
import { auth } from "@/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZUID Dashboards",
  description: "ClickUp projectmanagement dashboards voor ZUID",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cache = loadCache();
  const session = await auth();
  const user = session?.user ?? null;

  return (
    <html lang="nl">
      <body className={`${inter.className} bg-gray-100`}>
        <div className="flex min-h-screen">
          <Sidebar
            syncedAt={cache?.syncedAt ?? null}
            userEmail={user?.email ?? null}
            userName={user?.name ?? null}
            userImage={user?.image ?? null}
          />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

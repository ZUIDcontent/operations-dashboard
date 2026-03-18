import { loadCache } from "@/lib/data";
import FinancialWithFilter from "./FinancialWithFilter";

export const dynamic = "force-dynamic";

export default function FinancialPage() {
  const cache = loadCache();
  if (!cache) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">Geen data beschikbaar</p>
          <p className="text-sm text-gray-500 mt-1">
            Draai <code className="bg-gray-200 px-1.5 py-0.5 rounded">node sync.mjs</code> om data op te halen.
          </p>
        </div>
      </div>
    );
  }

  return <FinancialWithFilter projects={cache.projects} />;
}

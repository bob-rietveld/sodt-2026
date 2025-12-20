"use client";

import { useUrlFilters } from "@/hooks/use-url-filters";

interface FilterPanelProps {
  options: {
    continents: string[];
    industries: string[];
    companies: string[];
    years: string[];
  };
}

const continentLabels: Record<string, string> = {
  us: "United States",
  eu: "Europe",
  asia: "Asia",
  global: "Global",
  other: "Other",
};

const industryLabels: Record<string, string> = {
  semicon: "Semiconductor",
  deeptech: "Deep Tech",
  biotech: "Biotech",
  fintech: "Fintech",
  cleantech: "Clean Tech",
  other: "Other",
};

export function FilterPanel({ options }: FilterPanelProps) {
  const { filters, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  return (
    <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
      {/* Header - aligned with search bar height */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/10 bg-foreground/[0.02]">
        <h2 className="font-semibold text-lg">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Region Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Region
          </label>
          <select
            value={filters.continent ?? ""}
            onChange={(e) => setFilter("continent", e.target.value || undefined)}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
          >
            <option value="">All Regions</option>
            {options.continents.map((c) => (
              <option key={c} value={c}>
                {continentLabels[c] ?? c}
              </option>
            ))}
          </select>
        </div>

        {/* Industry Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Industry
          </label>
          <select
            value={filters.industry ?? ""}
            onChange={(e) => setFilter("industry", e.target.value || undefined)}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
          >
            <option value="">All Industries</option>
            {options.industries.map((i) => (
              <option key={i} value={i}>
                {industryLabels[i] ?? i}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Year
          </label>
          <select
            value={filters.year ?? ""}
            onChange={(e) => setFilter("year", e.target.value || undefined)}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
          >
            <option value="">All Years</option>
            {options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Company Search */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Company
          </label>
          <input
            type="text"
            value={filters.company ?? ""}
            onChange={(e) => setFilter("company", e.target.value || undefined)}
            placeholder="Search companies..."
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
    </div>
  );
}

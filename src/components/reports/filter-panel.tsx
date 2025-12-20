"use client";

import { useMemo } from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { MultiSelectDropdown, FilterOption } from "@/components/ui/multi-select-dropdown";

interface FilterPanelProps {
  options: {
    continents: FilterOption[];
    industries: FilterOption[];
    companies: FilterOption[];
    years: FilterOption[];
    technologyAreas: FilterOption[];
    keywords: FilterOption[];
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

  // Add labels to continent options
  const continentOptions = useMemo(() =>
    options.continents.map((opt) => ({
      ...opt,
      label: continentLabels[opt.value] ?? opt.value,
    })),
    [options.continents]
  );

  // Add labels to industry options
  const industryOptions = useMemo(() =>
    options.industries.map((opt) => ({
      ...opt,
      label: industryLabels[opt.value] ?? opt.value,
    })),
    [options.industries]
  );

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
        {/* Technology Areas Filter */}
        {options.technologyAreas.length > 0 && (
          <MultiSelectDropdown
            label="Technology Areas"
            placeholder="Search technologies..."
            options={options.technologyAreas}
            selected={filters.technologyAreas ?? []}
            onChange={(selected) => setFilter("technologyAreas", selected)}
          />
        )}

        {/* Keywords Filter */}
        {options.keywords.length > 0 && (
          <MultiSelectDropdown
            label="Keywords"
            placeholder="Search keywords..."
            options={options.keywords}
            selected={filters.keywords ?? []}
            onChange={(selected) => setFilter("keywords", selected)}
          />
        )}

        {/* Region Filter */}
        {continentOptions.length > 0 && (
          <MultiSelectDropdown
            label="Region"
            placeholder="Search regions..."
            options={continentOptions}
            selected={filters.continents ?? []}
            onChange={(selected) => setFilter("continents", selected)}
          />
        )}

        {/* Industry Filter */}
        {industryOptions.length > 0 && (
          <MultiSelectDropdown
            label="Industry"
            placeholder="Search industries..."
            options={industryOptions}
            selected={filters.industries ?? []}
            onChange={(selected) => setFilter("industries", selected)}
          />
        )}

        {/* Year Filter */}
        {options.years.length > 0 && (
          <MultiSelectDropdown
            label="Year"
            placeholder="Search years..."
            options={options.years}
            selected={filters.years ?? []}
            onChange={(selected) => setFilter("years", selected)}
          />
        )}

        {/* Company Filter */}
        {options.companies.length > 0 && (
          <MultiSelectDropdown
            label="Company"
            placeholder="Search companies..."
            options={options.companies}
            selected={filters.companies ?? []}
            onChange={(selected) => setFilter("companies", selected)}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { FilterPanel } from "@/components/reports/filter-panel";
import { ReportCard } from "@/components/reports/report-card";
import { ReportTable } from "@/components/reports/report-table";
import { ViewToggle, ViewMode } from "@/components/reports/view-toggle";
import { Header } from "@/components/ui/header";
import { PDF } from "@/types";

function ReportsContentInner() {
  const { filters, setFilter, hasActiveFilters } = useUrlFilters();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // Fetch filter options
  const filterOptions = useQuery(api.pdfs.getFilterOptions);

  // Use fullTextSearch when there's a search query, otherwise use browseReports
  const searchResults = useQuery(
    api.pdfs.fullTextSearch,
    filters.search ? { query: filters.search } : "skip"
  );

  const browseResults = useQuery(
    api.pdfs.browseReports,
    !filters.search
      ? {
          continents: filters.continents,
          industries: filters.industries,
          companies: filters.companies,
          years: filters.years,
          technologyAreas: filters.technologyAreas,
          keywords: filters.keywords,
        }
      : "skip"
  );

  // Apply metadata filters to search results if needed
  const reports = useMemo(() => {
    if (filters.search && searchResults) {
      let filtered = [...searchResults];

      // Apply metadata filters on top of search results (OR within each filter, AND between filters)
      if (filters.continents && filters.continents.length > 0) {
        filtered = filtered.filter((r) =>
          r.continent && filters.continents!.includes(r.continent)
        );
      }
      if (filters.industries && filters.industries.length > 0) {
        filtered = filtered.filter((r) =>
          r.industry && filters.industries!.includes(r.industry)
        );
      }
      if (filters.companies && filters.companies.length > 0) {
        filtered = filtered.filter((r) =>
          r.company && filters.companies!.includes(r.company)
        );
      }
      if (filters.years && filters.years.length > 0) {
        filtered = filtered.filter((r) =>
          r.dateOrYear && filters.years!.includes(r.dateOrYear)
        );
      }
      // Filter by technology areas (report must have at least one of the selected areas)
      if (filters.technologyAreas && filters.technologyAreas.length > 0) {
        filtered = filtered.filter((r) =>
          r.technologyAreas?.some((area) => filters.technologyAreas!.includes(area))
        );
      }
      // Filter by keywords (report must have at least one of the selected keywords)
      if (filters.keywords && filters.keywords.length > 0) {
        filtered = filtered.filter((r) =>
          r.keywords?.some((keyword) => filters.keywords!.includes(keyword))
        );
      }

      return filtered;
    }
    return browseResults ?? undefined;
  }, [filters, searchResults, browseResults]);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter("search", searchInput || undefined);
  };

  // Clear search
  const clearSearch = () => {
    setSearchInput("");
    setFilter("search", undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold">Browse Reports</h1>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-foreground/20 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-primary rounded-full"></span>
            )}
          </button>
        </div>

        {/* Mobile Filter Panel */}
        {isFilterOpen && (
          <div className="lg:hidden mb-6">
            {filterOptions ? (
              <FilterPanel options={filterOptions} />
            ) : (
              <div className="bg-white p-6 rounded-xl border border-foreground/10">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-foreground/10 rounded w-20"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-6 lg:gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            {filterOptions ? (
              <div className="sticky top-24">
                <FilterPanel options={filterOptions} />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-foreground/10">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-foreground/10 rounded w-20"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                </div>
              </div>
            )}
          </aside>

          {/* Reports Content Area */}
          <div className="flex-1 min-w-0">
            {/* Search Bar - Now inside the content area for better alignment */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-foreground/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by title, company, author, or summary..."
                  className="w-full pl-12 pr-24 py-3 border border-foreground/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white text-base"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                  {(searchInput || filters.search) && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>
              {filters.search && (
                <p className="mt-2 text-sm text-foreground/60">
                  Showing results for &quot;{filters.search}&quot;
                </p>
              )}
            </form>

            {/* Results Count and View Toggle */}
            <div className="flex items-center justify-between mb-4">
              {reports && (
                <p className="text-foreground/60">
                  {reports.length} report{reports.length !== 1 ? "s" : ""} found
                </p>
              )}
              {!reports && <div />}
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>

            {/* Loading State */}
            {!reports && (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white p-6 rounded-xl border border-foreground/10 animate-pulse"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-24 bg-foreground/10 rounded"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-foreground/10 rounded w-3/4"></div>
                        <div className="h-4 bg-foreground/10 rounded w-1/4"></div>
                        <div className="h-4 bg-foreground/10 rounded w-full"></div>
                        <div className="h-4 bg-foreground/10 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reports List */}
            {reports && (
              viewMode === "card" ? (
                <div className="grid gap-4">
                  {reports.map((report: PDF) => (
                    <ReportCard key={report._id} report={report} />
                  ))}

                  {reports.length === 0 && (
                    <div className="text-center py-12 text-foreground/50">
                      No reports found matching your filters.
                    </div>
                  )}
                </div>
              ) : (
                <ReportTable reports={reports} />
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReportsContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-foreground/50">Loading...</div>
        </div>
      }
    >
      <ReportsContentInner />
    </Suspense>
  );
}

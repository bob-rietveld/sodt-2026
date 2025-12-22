"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { FilterPanel } from "@/components/reports/filter-panel";
import { ReportCard } from "@/components/reports/report-card";
import { ReportTable } from "@/components/reports/report-table";
import { ViewToggle, ViewMode } from "@/components/reports/view-toggle";
import { SortSelector, SortOption } from "@/components/reports/sort-selector";
import { Header } from "@/components/ui/header";
import { PDF } from "@/types";

const PAGE_SIZE = 15;

function ReportsContentInner() {
  const { filters, setFilter, hasActiveFilters } = useUrlFilters();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sortBy, setSortBy] = useState<SortOption>("recently_added");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.continent, filters.industry, filters.company, filters.year, filters.technologyAreas, filters.keywords, filters.search]);

  // Fetch filter options
  const filterOptions = useQuery(api.pdfs.getFilterOptions);

  // Use fullTextSearch when there's a search query (not paginated for now as search is limited)
  const searchResults = useQuery(
    api.pdfs.fullTextSearch,
    filters.search ? { query: filters.search } : "skip"
  );

  // Use paginated browse for non-search queries
  const browseResults = useQuery(
    api.pdfs.browseReportsPaginated,
    !filters.search
      ? {
          continent: filters.continent as
            | "us"
            | "eu"
            | "asia"
            | "global"
            | "other"
            | undefined,
          industry: filters.industry as
            | "semicon"
            | "deeptech"
            | "biotech"
            | "fintech"
            | "cleantech"
            | "other"
            | undefined,
          company: filters.company,
          year: filters.year,
          technologyAreas: filters.technologyAreas,
          keywords: filters.keywords,
          page: currentPage,
          pageSize: PAGE_SIZE,
        }
      : "skip"
  );

  // Helper function to get year from dateOrYear field (handles both string and number)
  const getYear = (dateOrYear: number | string | undefined): number => {
    if (typeof dateOrYear === "number") return dateOrYear;
    if (typeof dateOrYear === "string") {
      const parsed = parseInt(dateOrYear, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Pagination info for non-search browse
  const paginationInfo = useMemo(() => {
    if (!filters.search && browseResults) {
      return {
        totalCount: browseResults.totalCount,
        totalPages: browseResults.totalPages,
        currentPage: browseResults.currentPage,
        hasNextPage: browseResults.hasNextPage,
        hasPreviousPage: browseResults.hasPreviousPage,
      };
    }
    return null;
  }, [filters.search, browseResults]);

  // Apply metadata filters to search results if needed, then sort
  const reports = useMemo(() => {
    let results: PDF[] | undefined;

    if (filters.search && searchResults) {
      let filtered = [...searchResults];

      // Apply metadata filters on top of search results
      if (filters.continent) {
        filtered = filtered.filter((r) => r.continent === filters.continent);
      }
      if (filters.industry) {
        filtered = filtered.filter((r) => r.industry === filters.industry);
      }
      if (filters.company) {
        filtered = filtered.filter((r) =>
          r.company?.toLowerCase().includes(filters.company!.toLowerCase())
        );
      }
      if (filters.year) {
        filtered = filtered.filter((r) => r.dateOrYear === filters.year);
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

      results = filtered;
    } else if (browseResults) {
      // Use paginated results directly (already sorted on server)
      results = browseResults.reports as PDF[];
    }

    // Apply sorting for search results only (browse results are sorted on server)
    if (results && filters.search) {
      if (sortBy === "recently_added") {
        results.sort((a, b) => b.uploadedAt - a.uploadedAt);
      } else if (sortBy === "published_date") {
        results.sort((a, b) => getYear(b.dateOrYear) - getYear(a.dateOrYear));
      }
    }

    return results;
  }, [filters, searchResults, browseResults, sortBy]);

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

            {/* Results Count, Sort, and View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4">
                {reports && (
                  <p className="text-foreground/60">
                    {paginationInfo ? (
                      <>
                        Showing {reports.length} of {paginationInfo.totalCount} report{paginationInfo.totalCount !== 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        {reports.length} report{reports.length !== 1 ? "s" : ""} found
                      </>
                    )}
                  </p>
                )}
                {!reports && <div />}
              </div>
              <div className="flex items-center gap-3">
                <SortSelector sortBy={sortBy} onSortChange={setSortBy} />
                <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reports.map((report: PDF) => (
                    <ReportCard key={report._id} report={report} />
                  ))}

                  {reports.length === 0 && (
                    <div className="col-span-full text-center py-12 text-foreground/50">
                      No reports found matching your filters.
                    </div>
                  )}
                </div>
              ) : (
                <ReportTable reports={reports} sortBy={sortBy} onSortChange={setSortBy} />
              )
            )}

            {/* Pagination Controls */}
            {paginationInfo && paginationInfo.totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-foreground/10 px-4 py-3">
                <div className="text-sm text-foreground/60">
                  Page <span className="font-medium text-foreground">{paginationInfo.currentPage}</span> of{" "}
                  <span className="font-medium text-foreground">{paginationInfo.totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!paginationInfo.hasPreviousPage}
                    className="px-4 py-2 bg-white border border-foreground/20 text-foreground/70 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  {/* Page number buttons */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                      // Calculate which page numbers to show
                      let pageNum: number;
                      if (paginationInfo.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (paginationInfo.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (paginationInfo.currentPage >= paginationInfo.totalPages - 2) {
                        pageNum = paginationInfo.totalPages - 4 + i;
                      } else {
                        pageNum = paginationInfo.currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            pageNum === paginationInfo.currentPage
                              ? "bg-primary text-white"
                              : "bg-white border border-foreground/20 text-foreground/70 hover:bg-foreground/5"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(paginationInfo.totalPages, p + 1))}
                    disabled={!paginationInfo.hasNextPage}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
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

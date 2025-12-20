"use client";

import { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { FilterPanel } from "@/components/reports/filter-panel";
import { ReportCard } from "@/components/reports/report-card";
import { Header } from "@/components/ui/header";
import { PDF } from "@/types";

function ReportsContentInner() {
  const { filters, hasActiveFilters } = useUrlFilters();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch filter options
  const filterOptions = useQuery(api.pdfs.getFilterOptions);

  // Fetch reports with filters
  const reports = useQuery(api.pdfs.browseReports, {
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
  });

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

        <div className="flex gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
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

          {/* Reports Grid */}
          <div className="flex-1 min-w-0">
            {/* Results Count */}
            {reports && (
              <p className="text-foreground/60 mb-4">
                {reports.length} report{reports.length !== 1 ? "s" : ""} found
              </p>
            )}

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

            {/* Reports Grid */}
            {reports && (
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

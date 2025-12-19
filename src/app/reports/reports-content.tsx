"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { FilterPanel } from "@/components/reports/filter-panel";
import { ReportCard } from "@/components/reports/report-card";
import { PDF } from "@/types";

function ReportsContentInner() {
  const { filters } = useUrlFilters();

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
      {/* Header */}
      <header className="border-b border-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold text-primary">
            Techleap
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/reports"
              className="text-primary font-medium"
            >
              Reports
            </Link>
            <Link
              href="/search"
              className="text-foreground hover:text-primary transition-colors"
            >
              Search
            </Link>
            <Link
              href="/chat"
              className="text-foreground hover:text-primary transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/upload"
              className="text-foreground hover:text-primary transition-colors"
            >
              Upload
            </Link>
            <Link
              href="/admin"
              className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold mb-8">Browse Reports</h1>

        <div className="flex gap-8">
          {/* Filter Sidebar */}
          <aside className="w-64 flex-shrink-0">
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
          </aside>

          {/* Reports Grid */}
          <div className="flex-1">
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

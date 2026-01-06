"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const industryLabels: Record<string, string> = {
  semicon: "Semiconductor",
  deeptech: "Deep Tech",
  biotech: "Biotech",
  fintech: "Fintech",
  cleantech: "Clean Tech",
  other: "Other",
};

export function HomeContent() {
  const stats = useQuery(api.pdfs.getHomeStats);
  const latestReports = useQuery(api.pdfs.getLatestReports, { limit: 6 });

  return (
    <>
      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-12 sm:mb-16 py-6 sm:py-8 border-y border-foreground/10">
        <div className="text-center">
          <p className="text-3xl sm:text-4xl font-semibold text-primary">
            {stats?.totalReports ?? "..."}
          </p>
          <p className="text-foreground/60 mt-2 text-sm sm:text-base">
            Reports Available
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl sm:text-4xl font-semibold text-primary">
            {stats?.uniqueCompanies ?? "..."}
          </p>
          <p className="text-foreground/60 mt-2 text-sm sm:text-base">
            Companies Covered
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl sm:text-4xl font-semibold text-primary">
            {stats?.uniqueTechnologyAreas ?? "..."}
          </p>
          <p className="text-foreground/60 mt-2 text-sm sm:text-base">
            Technology Areas
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl sm:text-4xl font-semibold text-primary">
            {stats?.yearRange
              ? `${stats.yearRange.min}-${stats.yearRange.max}`
              : "..."}
          </p>
          <p className="text-foreground/60 mt-2 text-sm sm:text-base">
            Years Covered
          </p>
        </div>
      </div>

      {/* Latest Reports Section */}
      {latestReports && latestReports.length > 0 && (
        <div className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl sm:text-2xl font-semibold text-foreground">
              Latest Reports
            </h3>
            <Link
              href="/reports"
              className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
            >
              View all
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {latestReports.map((report) => (
              <Link
                key={report._id}
                href={`/reports/${report._id}`}
                onClick={() => {
                  // Track report click from home page
                  import("@/lib/analytics/client").then(({ trackEvent }) => {
                    trackEvent("report_click", {
                      reportId: report._id,
                      reportTitle: report.title,
                      company: report.company || null,
                      industry: report.industry || null,
                      continent: report.continent || null,
                      source: "home_page",
                    });
                  }).catch(() => {
                    // Silently fail
                  });
                }}
                className="group bg-white rounded-xl border border-foreground/10 overflow-hidden hover:border-primary/20 hover:shadow-lg transition-all active:scale-[0.99]"
              >
                {/* Thumbnail */}
                <div className="relative h-36 sm:h-44 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
                  {report.thumbnailUrl ? (
                    <img
                      src={report.thumbnailUrl}
                      alt={report.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-primary/30"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {/* Industry badge */}
                  {report.industry && (
                    <span className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-white/90 text-foreground/80 shadow-sm">
                      {industryLabels[report.industry] ?? report.industry}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h4 className="font-semibold text-sm sm:text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                    {report.title}
                  </h4>

                  {report.company && (
                    <p className="text-xs text-foreground/60 mb-2">
                      {report.company}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    {/* Technology areas */}
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {report.technologyAreas?.slice(0, 2).map((area) => (
                        <span
                          key={area}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary truncate max-w-[80px]"
                        >
                          {area}
                        </span>
                      ))}
                      {report.technologyAreas &&
                        report.technologyAreas.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-foreground/5 text-foreground/50">
                            +{report.technologyAreas.length - 2}
                          </span>
                        )}
                    </div>

                    {/* Year */}
                    {report.dateOrYear && (
                      <span className="text-xs text-foreground/50 ml-2 flex-shrink-0">
                        {report.dateOrYear}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for reports */}
      {!latestReports && (
        <div className="mb-12 sm:mb-16">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-6">
            Latest Reports
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-foreground/10 overflow-hidden animate-pulse"
              >
                <div className="h-36 sm:h-44 bg-foreground/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-foreground/10 rounded w-3/4" />
                  <div className="h-3 bg-foreground/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

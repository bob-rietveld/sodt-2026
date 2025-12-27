"use client";

import Link from "next/link";
import { BrowseReport } from "@/types";
import { SortOption } from "./sort-selector";

interface ReportTableProps {
  reports: BrowseReport[];
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
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

export function ReportTable({ reports, sortBy, onSortChange }: ReportTableProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-foreground/50">
        No reports found matching your filters.
      </div>
    );
  }

  const SortableHeader = ({
    children,
    sortKey
  }: {
    children: React.ReactNode;
    sortKey: SortOption;
  }) => {
    const isActive = sortBy === sortKey;

    return (
      <th
        className="text-left px-4 py-3 text-sm font-semibold text-foreground/70 cursor-pointer hover:text-foreground transition-colors group"
        onClick={() => onSortChange?.(sortKey)}
      >
        <div className="flex items-center gap-1">
          {children}
          <svg
            className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-foreground/5 border-b border-foreground/10">
            <tr>
              <SortableHeader sortKey="recently_added">
                Title
              </SortableHeader>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground/70">
                Company
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground/70">
                Region
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground/70">
                Industry
              </th>
              <SortableHeader sortKey="published_date">
                Year
              </SortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {reports.map((report) => (
              <tr
                key={report._id}
                className="hover:bg-foreground/5 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/reports/${report._id}`}
                    className="flex items-center gap-3 group"
                  >
                    {/* Small thumbnail */}
                    <div className="flex-shrink-0">
                      {report.thumbnailUrl ? (
                        <img
                          src={report.thumbnailUrl}
                          alt=""
                          className="w-8 h-10 object-cover rounded border border-foreground/10"
                        />
                      ) : (
                        <div className="w-8 h-10 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-foreground/30"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {report.title}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-foreground/70">
                  {report.company || "—"}
                </td>
                <td className="px-4 py-3">
                  {report.continent ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info">
                      {continentLabels[report.continent] ?? report.continent}
                    </span>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {report.industry ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-secondary/10 text-secondary">
                      {industryLabels[report.industry] ?? report.industry}
                    </span>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-foreground/70">
                  {report.dateOrYear || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List View (simplified table) */}
      <div className="sm:hidden divide-y divide-foreground/10">
        {reports.map((report) => (
          <Link
            key={report._id}
            href={`/reports/${report._id}`}
            className="flex items-center gap-3 p-3 hover:bg-foreground/5 transition-colors active:bg-foreground/10"
          >
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              {report.thumbnailUrl ? (
                <img
                  src={report.thumbnailUrl}
                  alt=""
                  className="w-10 h-12 object-cover rounded border border-foreground/10"
                />
              ) : (
                <div className="w-10 h-12 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-foreground/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground line-clamp-1">
                {report.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {report.company && (
                  <span className="text-xs text-foreground/60 truncate">
                    {report.company}
                  </span>
                )}
                {report.dateOrYear && (
                  <span className="text-xs text-foreground/50">
                    {report.dateOrYear}
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <svg
              className="w-4 h-4 text-foreground/30 flex-shrink-0"
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
        ))}
      </div>
    </div>
  );
}

"use client";

export type SortField = "recently_added" | "published_date";
export type SortDirection = "asc" | "desc";

// Keep SortOption as alias for backward compatibility
export type SortOption = SortField;

interface SortSelectorProps {
  sortBy: SortField;
  sortDirection: SortDirection;
  onSortChange: (sort: SortField) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function SortSelector({
  sortBy,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
}: SortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-foreground/60 hidden sm:inline">Sort by:</span>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortField)}
        className="px-3 py-1.5 bg-white border border-foreground/20 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        <option value="recently_added">Recently Added</option>
        <option value="published_date">Published Date</option>
      </select>
      <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-1">
        <button
          onClick={() => onSortDirectionChange("desc")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sortDirection === "desc"
              ? "bg-white text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          }`}
          title="Sort descending (newest first)"
        >
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
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          <span className="hidden sm:inline">Newest</span>
        </button>
        <button
          onClick={() => onSortDirectionChange("asc")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sortDirection === "asc"
              ? "bg-white text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          }`}
          title="Sort ascending (oldest first)"
        >
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
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
          <span className="hidden sm:inline">Oldest</span>
        </button>
      </div>
    </div>
  );
}

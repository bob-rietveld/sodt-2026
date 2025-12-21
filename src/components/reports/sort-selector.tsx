"use client";

export type SortOption = "recently_added" | "published_date";

interface SortSelectorProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function SortSelector({ sortBy, onSortChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-foreground/60 hidden sm:inline">Sort by:</span>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="px-3 py-1.5 bg-white border border-foreground/20 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        <option value="recently_added">Recently Added</option>
        <option value="published_date">Published Date</option>
      </select>
    </div>
  );
}

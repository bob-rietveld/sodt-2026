"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface ReportFilters {
  search?: string;
  continents?: string[];
  industries?: string[];
  companies?: string[];
  years?: string[];
  technologyAreas?: string[];
  keywords?: string[];
}

// Helper to parse comma-separated URL param to array
function parseArrayParam(param: string | null): string[] | undefined {
  return param ? param.split(",").filter(Boolean) : undefined;
}

export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current filters from URL
  const filters: ReportFilters = useMemo(() => {
    return {
      search: searchParams.get("search") ?? undefined,
      continents: parseArrayParam(searchParams.get("continents")),
      industries: parseArrayParam(searchParams.get("industries")),
      companies: parseArrayParam(searchParams.get("companies")),
      years: parseArrayParam(searchParams.get("years")),
      technologyAreas: parseArrayParam(searchParams.get("technologyAreas")),
      keywords: parseArrayParam(searchParams.get("keywords")),
    };
  }, [searchParams]);

  // Update a single filter (supports both string and array values)
  const setFilter = useCallback(
    (key: keyof ReportFilters, value: string | string[] | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return Boolean(value);
    });
  }, [filters]);

  return { filters, setFilter, clearFilters, hasActiveFilters };
}

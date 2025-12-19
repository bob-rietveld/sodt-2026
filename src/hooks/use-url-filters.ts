"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface ReportFilters {
  continent?: string;
  industry?: string;
  company?: string;
  year?: string;
}

export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current filters from URL
  const filters: ReportFilters = useMemo(
    () => ({
      continent: searchParams.get("continent") ?? undefined,
      industry: searchParams.get("industry") ?? undefined,
      company: searchParams.get("company") ?? undefined,
      year: searchParams.get("year") ?? undefined,
    }),
    [searchParams]
  );

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof ReportFilters, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
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
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return { filters, setFilter, clearFilters, hasActiveFilters };
}

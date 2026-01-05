"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { FilterPanel } from "@/components/reports/filter-panel";
import { Header } from "@/components/ui/header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// Color palette for charts
const COLORS = {
  primary: "#6366f1",
  info: "#06b6d4",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#a855f7",
  pink: "#ec4899",
  slate: "#64748b",
};

const PIE_COLORS = [
  COLORS.primary,
  COLORS.info,
  COLORS.success,
  COLORS.warning,
  COLORS.purple,
  COLORS.pink,
  COLORS.slate,
  COLORS.danger,
];

// Line colors for technology trends
const LINE_COLORS = [
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
];

// Label mappings
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

const documentTypeLabels: Record<string, string> = {
  pitch_deck: "Pitch Deck",
  market_research: "Market Research",
  financial_report: "Financial Report",
  white_paper: "White Paper",
  case_study: "Case Study",
  annual_report: "Annual Report",
  investor_update: "Investor Update",
  other: "Other",
};

type TabType = "overview" | "deep-dive";

function InsightsContentInner() {
  const { filters, setFilter, hasActiveFilters, clearFilters } = useUrlFilters();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Fetch data
  const insightsData = useQuery(api.pdfs.getInsightsData);
  const filterOptions = useQuery(api.pdfs.getFilterOptions);
  const filteredCount = useQuery(api.pdfs.getBrowseReportsCount, {
    continent: filters.continent as "us" | "eu" | "asia" | "global" | "other" | undefined,
    industry: filters.industry as "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other" | undefined,
    company: filters.company,
    year: filters.year,
    technologyAreas: filters.technologyAreas,
    keywords: filters.keywords,
  });

  // Compute filtered stats based on current filters
  const filteredStats = useMemo(() => {
    if (!insightsData) return null;

    // If no filters, return the original stats
    if (!hasActiveFilters) {
      return {
        totalReports: insightsData.totalReports,
        uniqueCompanies: insightsData.uniqueCompanies,
        uniqueTechnologyAreas: insightsData.uniqueTechnologyAreas,
        yearRange: insightsData.yearRange,
      };
    }

    // When filters are active, use the filteredCount and show filtered context
    // For companies and tech areas, we'll show the selected count or "filtered"
    const selectedTechCount = filters.technologyAreas?.length || 0;
    const hasYearFilter = filters.year !== undefined;

    return {
      totalReports: filteredCount ?? "...",
      uniqueCompanies: filters.company ? 1 : "—",
      uniqueTechnologyAreas: selectedTechCount > 0 ? selectedTechCount : "—",
      yearRange: hasYearFilter ? filters.year : insightsData.yearRange
        ? `${insightsData.yearRange.min}-${insightsData.yearRange.max}`
        : "N/A",
    };
  }, [insightsData, hasActiveFilters, filteredCount, filters]);

  // Transform data for charts
  const yearChartData = useMemo(() => {
    if (!insightsData?.reportsByYear) return [];
    return Object.entries(insightsData.reportsByYear)
      .map(([year, count]) => ({
        year: parseInt(year),
        count,
        isSelected: filters.year === parseInt(year),
      }))
      .sort((a, b) => a.year - b.year);
  }, [insightsData?.reportsByYear, filters.year]);

  const industryChartData = useMemo(() => {
    if (!insightsData?.industryDistribution) return [];
    return Object.entries(insightsData.industryDistribution).map(([key, value]) => ({
      name: industryLabels[key] || key,
      value,
      key,
    }));
  }, [insightsData?.industryDistribution]);

  const continentChartData = useMemo(() => {
    if (!insightsData?.continentDistribution) return [];
    return Object.entries(insightsData.continentDistribution)
      .map(([key, value]) => ({
        name: continentLabels[key] || key,
        value,
        key,
      }))
      .sort((a, b) => b.value - a.value);
  }, [insightsData?.continentDistribution]);

  const documentTypeChartData = useMemo(() => {
    if (!insightsData?.documentTypeDistribution) return [];
    return Object.entries(insightsData.documentTypeDistribution).map(([key, value]) => ({
      name: documentTypeLabels[key] || key,
      value,
      key,
    }));
  }, [insightsData?.documentTypeDistribution]);

  // Technology trends data - filtered by selected technologies
  const technologyTrendsData = useMemo(() => {
    if (!insightsData?.technologyTrendsByYear) return [];
    const selectedTechs = filters.technologyAreas || [];
    if (selectedTechs.length === 0) return [];

    return Object.entries(insightsData.technologyTrendsByYear)
      .map(([year, techs]) => ({
        year: parseInt(year),
        ...Object.fromEntries(selectedTechs.map((tech) => [tech, techs[tech] || 0])),
      }))
      .sort((a, b) => a.year - b.year);
  }, [insightsData?.technologyTrendsByYear, filters.technologyAreas]);

  // Build URL params for "View Reports" link
  const buildReportsUrl = () => {
    const params = new URLSearchParams();
    if (filters.continent) params.set("continent", filters.continent);
    if (filters.industry) params.set("industry", filters.industry);
    if (filters.company) params.set("company", filters.company);
    if (filters.year) params.set("year", filters.year.toString());
    if (filters.technologyAreas?.length) params.set("technologyAreas", filters.technologyAreas.join(","));
    if (filters.keywords?.length) params.set("keywords", filters.keywords.join(","));
    const queryString = params.toString();
    return queryString ? `/reports?${queryString}` : "/reports";
  };

  const isLoading = !insightsData || !filterOptions;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">Insights</h1>
            <p className="text-foreground/60 mt-1">
              Explore trends and patterns across the report collection
            </p>
          </div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-foreground/20 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {hasActiveFilters && <span className="w-2 h-2 bg-primary rounded-full"></span>}
          </button>
        </div>

        {/* Mobile Filter Panel */}
        {isFilterOpen && (
          <div className="lg:hidden mb-6">
            {filterOptions ? (
              <FilterPanel options={filterOptions} />
            ) : (
              <div className="bg-white p-6 rounded-xl border border-foreground/10 animate-pulse">
                <div className="h-6 bg-foreground/10 rounded w-20 mb-4"></div>
                <div className="space-y-3">
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
            <div className="sticky top-24 space-y-4">
              {filterOptions ? (
                <FilterPanel options={filterOptions} />
              ) : (
                <div className="bg-white p-6 rounded-xl border border-foreground/10 animate-pulse">
                  <div className="h-6 bg-foreground/10 rounded w-20 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-10 bg-foreground/10 rounded"></div>
                    <div className="h-10 bg-foreground/10 rounded"></div>
                  </div>
                </div>
              )}

              {/* View Reports Button */}
              {hasActiveFilters && (
                <Link
                  href={buildReportsUrl()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  View {filteredCount ?? "..."} Reports
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                {/* Hero Stats - Now filtered */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    value={filteredStats?.totalReports ?? "..."}
                    label={hasActiveFilters ? "Matching Reports" : "Total Reports"}
                    color="primary"
                    isFiltered={hasActiveFilters}
                  />
                  <StatCard
                    value={hasActiveFilters ? (filteredStats?.uniqueCompanies ?? "...") : insightsData.uniqueCompanies}
                    label="Companies"
                    color="info"
                    isFiltered={hasActiveFilters && !!filters.company}
                  />
                  <StatCard
                    value={hasActiveFilters && filters.technologyAreas?.length
                      ? filters.technologyAreas.length
                      : insightsData.uniqueTechnologyAreas}
                    label={hasActiveFilters && filters.technologyAreas?.length ? "Selected Tech" : "Technology Areas"}
                    color="success"
                    isFiltered={hasActiveFilters && !!filters.technologyAreas?.length}
                  />
                  <StatCard
                    value={
                      filters.year
                        ? filters.year
                        : insightsData.yearRange
                          ? `${insightsData.yearRange.min}-${insightsData.yearRange.max}`
                          : "N/A"
                    }
                    label={filters.year ? "Selected Year" : "Years Covered"}
                    color="warning"
                    isFiltered={!!filters.year}
                  />
                </div>

                {/* Filter indicator */}
                {hasActiveFilters && (
                  <div className="mb-6 flex items-center gap-2 text-sm text-foreground/60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span>Stats reflect current filter selection</span>
                    <button
                      onClick={clearFilters}
                      className="text-primary hover:underline ml-2"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 bg-foreground/5 rounded-lg mb-6 w-fit">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "overview"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("deep-dive")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "deep-dive"
                        ? "bg-white text-foreground shadow-sm"
                        : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    Deep Dive
                  </button>
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Charts Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Reports by Year */}
                      <ChartCard title="Reports by Year" subtitle="Click a bar to filter by year">
                        {yearChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={yearChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                }}
                              />
                              <Bar
                                dataKey="count"
                                radius={[4, 4, 0, 0]}
                                cursor="pointer"
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onClick={(data: any) => {
                                  if (data?.year) {
                                    // Toggle year filter
                                    if (filters.year === data.year) {
                                      setFilter("year", undefined);
                                    } else {
                                      setFilter("year", data.year);
                                    }
                                  }
                                }}
                              >
                                {yearChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isSelected ? COLORS.warning : COLORS.primary}
                                    opacity={filters.year && !entry.isSelected ? 0.4 : 1}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyChart message="No year data available" />
                        )}
                      </ChartCard>

                      {/* Industry Distribution */}
                      <ChartCard title="Industry Distribution" subtitle="Click a segment to filter">
                        {industryChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={industryChartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={40}
                                paddingAngle={2}
                                dataKey="value"
                                cursor="pointer"
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onClick={(data: any) => {
                                  if (data?.key) {
                                    // Toggle industry filter
                                    if (filters.industry === data.key) {
                                      setFilter("industry", undefined);
                                    } else {
                                      setFilter("industry", data.key);
                                    }
                                  }
                                }}
                              >
                                {industryChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                    opacity={filters.industry && filters.industry !== entry.key ? 0.3 : 1}
                                    stroke={filters.industry === entry.key ? "#000" : "none"}
                                    strokeWidth={filters.industry === entry.key ? 2 : 0}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                }}
                              />
                              <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                iconType="circle"
                                iconSize={8}
                                formatter={(value) => (
                                  <span className="text-sm text-foreground/80">{value}</span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyChart message="No industry data available" />
                        )}
                      </ChartCard>

                      {/* Geographic Coverage */}
                      <ChartCard title="Geographic Coverage" subtitle="Click a bar to filter by region">
                        {continentChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={continentChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis type="number" tick={{ fontSize: 12 }} />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                width={100}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                }}
                              />
                              <Bar
                                dataKey="value"
                                radius={[0, 4, 4, 0]}
                                cursor="pointer"
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onClick={(data: any) => {
                                  if (data?.key) {
                                    // Toggle continent filter
                                    if (filters.continent === data.key) {
                                      setFilter("continent", undefined);
                                    } else {
                                      setFilter("continent", data.key);
                                    }
                                  }
                                }}
                              >
                                {continentChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={filters.continent === entry.key ? COLORS.warning : COLORS.info}
                                    opacity={filters.continent && filters.continent !== entry.key ? 0.4 : 1}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyChart message="No geographic data available" />
                        )}
                      </ChartCard>

                      {/* Document Types */}
                      <ChartCard title="Document Types">
                        {documentTypeChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={documentTypeChartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={40}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {documentTypeChartData.map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                }}
                              />
                              <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                iconType="circle"
                                iconSize={8}
                                formatter={(value) => (
                                  <span className="text-sm text-foreground/80">{value}</span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyChart message="No document type data available" />
                        )}
                      </ChartCard>
                    </div>
                  </div>
                )}

                {/* Deep Dive Tab */}
                {activeTab === "deep-dive" && (
                  <div className="space-y-6">
                    {/* Top Technology Areas */}
                    <ChartCard
                      title="Top Technology Areas"
                      subtitle="Click bars to select technologies for the trends chart below"
                    >
                      {insightsData.topTechnologyAreas.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={insightsData.topTechnologyAreas.slice(0, 12)}
                            layout="vertical"
                            margin={{ left: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 11 }}
                              width={150}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar
                              dataKey="count"
                              radius={[0, 4, 4, 0]}
                              cursor="pointer"
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              onClick={(data: any) => {
                                if (!data?.name) return;
                                const current = filters.technologyAreas || [];
                                if (current.includes(data.name)) {
                                  setFilter(
                                    "technologyAreas",
                                    current.filter((t: string) => t !== data.name)
                                  );
                                } else {
                                  setFilter("technologyAreas", [...current, data.name]);
                                }
                              }}
                            >
                              {insightsData.topTechnologyAreas.slice(0, 12).map((entry, index) => {
                                const isSelected = filters.technologyAreas?.includes(entry.name);
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={isSelected ? LINE_COLORS[filters.technologyAreas!.indexOf(entry.name) % LINE_COLORS.length] : COLORS.success}
                                    opacity={filters.technologyAreas?.length && !isSelected ? 0.4 : 1}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart message="No technology area data available" />
                      )}
                    </ChartCard>

                    {/* Technology Trends Over Time */}
                    <ChartCard
                      title="Technology Trends Over Time"
                      subtitle={
                        filters.technologyAreas?.length
                          ? `Showing ${filters.technologyAreas.length} selected technolog${filters.technologyAreas.length === 1 ? 'y' : 'ies'}`
                          : "Select technologies from the chart above to see trends"
                      }
                    >
                      {technologyTrendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <AreaChart data={technologyTrendsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend />
                            {(filters.technologyAreas || []).map((tech, index) => (
                              <Area
                                key={tech}
                                type="monotone"
                                dataKey={tech}
                                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                fill={LINE_COLORS[index % LINE_COLORS.length]}
                                fillOpacity={0.2}
                                strokeWidth={2}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-foreground/50">
                          <svg
                            className="w-12 h-12 mb-3 text-foreground/30"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                            />
                          </svg>
                          <p className="text-sm">Select technologies to see trends over time</p>
                          <p className="text-xs mt-1 text-foreground/40">
                            Click on bars in the chart above
                          </p>
                        </div>
                      )}
                    </ChartCard>

                    {/* Top Keywords */}
                    <ChartCard
                      title="Top Keywords"
                      subtitle="Click keywords to add them to your filter"
                    >
                      {insightsData.topKeywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2 py-4">
                          {insightsData.topKeywords.map((keyword) => {
                            const isSelected = filters.keywords?.includes(keyword.name);
                            const maxCount = insightsData.topKeywords[0]?.count || 1;
                            const opacity = 0.4 + (keyword.count / maxCount) * 0.6;
                            return (
                              <button
                                key={keyword.name}
                                onClick={() => {
                                  const current = filters.keywords || [];
                                  if (isSelected) {
                                    setFilter(
                                      "keywords",
                                      current.filter((k) => k !== keyword.name)
                                    );
                                  } else {
                                    setFilter("keywords", [...current, keyword.name]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                  isSelected
                                    ? "bg-primary text-white"
                                    : "bg-foreground/5 text-foreground/80 hover:bg-foreground/10"
                                }`}
                                style={{ opacity: isSelected ? 1 : opacity }}
                              >
                                {keyword.name}
                                <span className="ml-1.5 text-xs opacity-70">({keyword.count})</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyChart message="No keyword data available" />
                      )}
                    </ChartCard>
                  </div>
                )}
              </>
            )}

            {/* Mobile View Reports Button */}
            {hasActiveFilters && (
              <div className="lg:hidden fixed bottom-4 left-4 right-4 z-10">
                <Link
                  href={buildReportsUrl()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-xl font-medium shadow-lg"
                >
                  View {filteredCount ?? "..."} Reports
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  value,
  label,
  color,
  isFiltered = false,
}: {
  value: number | string;
  label: string;
  color: "primary" | "info" | "success" | "warning";
  isFiltered?: boolean;
}) {
  const colorClasses = {
    primary: "text-primary",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
  };

  return (
    <div className={`bg-white p-4 sm:p-6 rounded-xl border ${isFiltered ? 'border-primary/30 bg-primary/5' : 'border-foreground/10'}`}>
      <p className={`text-2xl sm:text-3xl font-semibold ${colorClasses[color]}`}>{value}</p>
      <p className="text-foreground/60 mt-1 text-sm flex items-center gap-1">
        {label}
        {isFiltered && (
          <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
        )}
      </p>
    </div>
  );
}

// Chart Card Component
function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white p-6 rounded-xl border border-foreground/10 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-foreground/60 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Empty Chart Placeholder
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-foreground/50">
      <p className="text-sm">{message}</p>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-foreground/10 animate-pulse">
            <div className="h-8 bg-foreground/10 rounded w-16 mb-2"></div>
            <div className="h-4 bg-foreground/10 rounded w-24"></div>
          </div>
        ))}
      </div>

      {/* Tab skeleton */}
      <div className="h-10 bg-foreground/5 rounded-lg w-48"></div>

      {/* Charts skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-foreground/10 animate-pulse">
            <div className="h-5 bg-foreground/10 rounded w-32 mb-4"></div>
            <div className="h-64 bg-foreground/5 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InsightsContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-foreground/50">Loading insights...</div>
        </div>
      }
    >
      <InsightsContentInner />
    </Suspense>
  );
}

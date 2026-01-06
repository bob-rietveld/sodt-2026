/**
 * Supported chart types for analytics visualizations
 */
export type ChartType = "bar" | "line" | "pie" | "area" | "table" | "metric";

/**
 * Chart specification returned by the LLM
 */
export interface ChartSpec {
  type: ChartType;
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  config: ChartConfig;
}

/**
 * Configuration for different chart types
 */
export interface ChartConfig {
  // For bar, line, area charts
  xAxis?: string;
  yAxis?: string | string[];

  // For pie charts
  nameKey?: string;
  valueKey?: string;

  // For metric cards
  value?: number | string;
  previousValue?: number;
  unit?: string;
  trend?: "up" | "down" | "neutral";

  // For tables
  columns?: TableColumn[];

  // Styling
  colors?: string[];
}

export interface TableColumn {
  key: string;
  label: string;
  format?: "number" | "date" | "percent" | "duration";
}

/**
 * Analytics query request
 */
export interface AnalyticsQueryRequest {
  question: string;
  conversationHistory?: ConversationMessage[];
}

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Analytics query response (streamed)
 */
export interface AnalyticsQueryResponse {
  // Streamed text response
  text?: string;

  // Chart to render (sent when complete)
  chart?: ChartSpec;

  // Tool calls made (for transparency)
  toolCalls?: ToolCallInfo[];

  // Error information
  error?: string;

  // Whether this is the final message
  done?: boolean;
}

export interface ToolCallInfo {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
}

/**
 * Saved analytics view (stored in Convex)
 */
export interface SavedAnalyticsView {
  _id: string;
  name: string;
  question: string;
  chartSpec: ChartSpec;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isShared: boolean;
}

/**
 * System prompt context for the analytics agent
 */
export const ANALYTICS_SYSTEM_PROMPT = `You are an analytics assistant for TechStaple, a document intelligence platform. Your job is to help admins understand their platform's usage by querying analytics data.

## Available Data

You have access to analytics tools (Tinybird pipes) that can answer questions about:
- **Search queries**: What users are searching for, popular terms, failed searches
- **Web traffic**: Page views, sessions, device types, traffic sources
- **Performance**: Response times, load times

## Response Format

When answering questions:
1. Call the appropriate tool to get data
2. Analyze the results
3. Provide a brief, insightful summary
4. Suggest a visualization type that best represents the data

After analyzing, output a JSON chart specification in this exact format:
\`\`\`chart
{
  "type": "bar" | "line" | "pie" | "area" | "table" | "metric",
  "title": "Chart Title",
  "description": "Brief description",
  "data": [...],
  "config": {
    "xAxis": "column_name",
    "yAxis": "column_name" | ["col1", "col2"],
    "nameKey": "for pie charts",
    "valueKey": "for pie charts",
    "value": "for metric cards",
    "unit": "for metric cards",
    "columns": [{"key": "col", "label": "Label"}]
  }
}
\`\`\`

## Chart Type Guidelines

- **bar**: Comparing categories (e.g., top search terms, traffic by device)
- **line**: Trends over time (e.g., daily searches, weekly traffic)
- **area**: Cumulative trends or volume over time
- **pie**: Part-to-whole relationships (e.g., traffic source breakdown)
- **table**: Detailed data with multiple columns
- **metric**: Single important number (e.g., total searches, avg response time)

## Error Handling

If a tool call fails or returns unexpected data:
1. Explain what went wrong
2. Suggest an alternative approach or question

Be concise and actionable in your responses.`;

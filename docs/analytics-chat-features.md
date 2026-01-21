# Analytics Chat Interface - New Features

## Overview
Enhanced the Tinybird analytics chat interface with two key improvements:
1. **Debug Mode** - Technical view for troubleshooting
2. **Data Catalog** - Discovery view for exploring available data

## 1. Debug Mode Toggle

### What It Does
- Shows detailed information about tool calls (Tinybird queries) made by the AI
- Displays both successful results and errors
- Only visible when explicitly enabled

### Features
- **Toggle Button**: Orange "Debug" button in the top-right corner
- **Visual Feedback**: Tool calls appear in orange-bordered boxes
- **Shows**:
  - Tool name (e.g., `popular_searches`)
  - Arguments passed (e.g., `{"days_back": 30, "limit": 20}`)
  - ✓ Successful results (first 10 rows, green)
  - ✗ Errors (red)

### Use Cases
- Developers debugging query issues
- Admins verifying correct data is being fetched
- Understanding what data the AI is using to generate charts

### How to Use
1. Click the "Debug" button in the top-right
2. Ask a question (e.g., "Show me top searches")
3. See the tool calls appear below the AI response
4. Click "Debug" again to hide technical details

## 2. Data Catalog Tab

### What It Does
- Shows all available Tinybird data sources
- Explains what each data source contains
- Provides example questions for each source

### Features
- **Two Tabs**: "Chat" and "Data Catalog"
- **Category Filters**: Filter by data type (Search Analytics, Traffic Analytics, etc.)
- **Expandable Cards**: Click to see details
- **Parameter Documentation**: Shows what parameters each data source accepts
- **Example Queries**: Click-to-use example questions

### Available Data Sources

#### Search Analytics
1. **popular_searches**
   - Most searched terms ranked by frequency
   - Parameters: days_back, limit
   - Examples: "What are the top 10 search queries?"

2. **searches_by_day**
   - Daily search volume trends
   - Parameters: days_back
   - Examples: "Show me search trends over the last 30 days"

3. **no_result_searches**
   - Queries that returned zero results
   - Parameters: limit
   - Examples: "Which searches returned no results?"

4. **recent_searches**
   - Most recent search activity
   - Parameters: limit
   - Examples: "Show me the latest searches"

#### Traffic Analytics
5. **popular_sources**
   - Traffic source breakdown
   - Parameters: days_back
   - Examples: "Where is our traffic coming from?"

#### Platform Metrics
6. **analytics_summary**
   - Overall platform KPIs
   - Parameters: days_back
   - Examples: "Give me a platform overview"

### Use Cases
- New users learning what data is available
- Discovering the right question to ask
- Understanding data source parameters
- Quick access to example queries

### How to Use
1. Click "Data Catalog" tab at the top
2. Browse or filter by category
3. Click on a data source to expand details
4. Click any example question to run it immediately
5. Returns to chat tab with results

## User Experience

### For Non-Technical Users
- **Clean Interface**: Debug mode is hidden by default
- **Guided Discovery**: Data catalog helps find the right questions
- **One-Click Examples**: No need to type complex queries

### For Technical Users
- **Debug Mode**: See exactly what queries are running
- **Parameter Details**: Understand data source capabilities
- **Error Visibility**: Quickly identify and fix issues

## Implementation Files

### New Components
- `/src/components/analytics/data-catalog.tsx` - Data catalog view

### Modified Components
- `/src/components/analytics/analytics-chat.tsx` - Added tabs and debug mode

### Key Features
- Tab navigation between Chat and Data Catalog
- Debug mode toggle with visual feedback
- Enhanced tool call display with results
- Click-to-use example queries
- Smooth navigation between tabs

## Next Steps (Optional Enhancements)

1. **Dynamic Data Catalog**: Fetch available tools from Tinybird MCP server
2. **Persistent Preferences**: Remember debug mode setting
3. **Export Debug Info**: Download tool call logs for troubleshooting
4. **Real-time Tool Preview**: Show query results before sending to AI
5. **Query History**: Search through past questions and results

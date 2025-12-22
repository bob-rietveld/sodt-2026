import FirecrawlApp from "@mendable/firecrawl-js";
import Anthropic from "@anthropic-ai/sdk";

export interface PDFMetadata {
  title: string;
  company: string;
  dateOrYear: number;  // Year of publication as integer (e.g., 2024)
  topic: string;
  summary: string;
  continent: "us" | "eu" | "asia" | "global" | "other";
  industry: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other";
  // Extended metadata (v2.0)
  documentType: "pitch_deck" | "market_research" | "financial_report" | "white_paper" | "case_study" | "annual_report" | "investor_update" | "other";
  authors: string[];
  keyFindings: string[];
  keywords: string[];
  technologyAreas: string[];
}

export interface ExtractionContext {
  existingKeywords?: string[];
  existingTechnologyAreas?: string[];
}

export interface ExtractionResult {
  success: boolean;
  data?: PDFMetadata;
  error?: string;
}

/**
 * Extract metadata from a PDF using Firecrawl to scrape + Claude to extract
 * @param publicUrl - The public URL of the PDF
 * @param context - Optional context with existing keywords and technology areas for consistency
 */
export async function extractPDFMetadata(
  publicUrl: string,
  context?: ExtractionContext
): Promise<ExtractionResult> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!firecrawlApiKey) {
    return {
      success: false,
      error: "FIRECRAWL_API_KEY must be set",
    };
  }

  if (!anthropicApiKey) {
    return {
      success: false,
      error: "ANTHROPIC_API_KEY must be set",
    };
  }

  try {
    // Step 1: Use Firecrawl to scrape the PDF content
    const firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey });

    console.log("Scraping PDF from URL:", publicUrl);

    // Request markdown content only (thumbnail is generated separately using pdf.js)
    // Increase timeout for large PDF files (default is 30s, set to 120s)
    const scrapeResult = await firecrawl.scrapeUrl(publicUrl, {
      formats: ["markdown"],
      timeout: 120000, // 2 minutes timeout for large PDFs
    });

    if (!scrapeResult.success) {
      return {
        success: false,
        error: `Firecrawl scrape failed: ${scrapeResult.error || "Unknown error"}`,
      };
    }

    const pdfContent = scrapeResult.markdown;

    if (!pdfContent || pdfContent.trim().length === 0) {
      return {
        success: false,
        error: "No content extracted from PDF",
      };
    }

    console.log("PDF content extracted, length:", pdfContent.length);

    // Step 2: Use Claude to extract structured metadata from the content
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Build context sections for keywords and technology areas
    let keywordsContext = "";
    if (context?.existingKeywords && context.existingKeywords.length > 0) {
      keywordsContext = `
EXISTING KEYWORDS IN DATABASE (prefer mapping to these when semantically equivalent):
${context.existingKeywords.join(", ")}

When extracting keywords, prefer using existing keywords from the list above if they match the document's content semantically. This ensures consistency and prevents fragmentation (e.g., use "Machine Learning" instead of "ML", use "Artificial Intelligence" instead of "AI/Artificial Intelligence"). Only introduce new keywords if no existing keyword adequately describes the concept.`;
    }

    let technologyAreasContext = "";
    if (context?.existingTechnologyAreas && context.existingTechnologyAreas.length > 0) {
      technologyAreasContext = `
EXISTING TECHNOLOGY AREAS IN DATABASE (prefer mapping to these when semantically equivalent):
${context.existingTechnologyAreas.join(", ")}

When extracting technology areas, prefer using existing technology areas from the list above if they match the document's content semantically. This ensures consistency and prevents fragmentation (e.g., use "Artificial Intelligence" instead of "AI", use "Machine Learning" instead of "Deep Learning" when referring to the same concept). Only introduce new technology areas if no existing one adequately describes the technology.`;
    }

    const extractionPrompt = `Analyze the following document content and extract metadata in JSON format.

Document content:
${pdfContent.substring(0, 15000)}
${keywordsContext}
${technologyAreasContext}

Extract the following fields:
- title: The title of the document or report
- company: The company name that authored or is the subject of the document
- dateOrYear: The publication year as an INTEGER (e.g., 2024, 2023). Extract ONLY the 4-digit year number, not a date string. If multiple years are mentioned, use the most recent publication year.
- topic: A brief topic description (1 sentence, max 100 characters)
- summary: A comprehensive executive summary of the document (2-4 paragraphs, covering key findings, insights, and conclusions)
- continent: The geographic region (must be one of: "us", "eu", "asia", "global", "other")
- industry: The industry sector (must be one of: "semicon", "deeptech", "biotech", "fintech", "cleantech", "other")
- documentType: Type of document (must be one of: "pitch_deck", "market_research", "financial_report", "white_paper", "case_study", "annual_report", "investor_update", "other")
- authors: Array of author names found in the document (empty array if not found, max 10)
- keyFindings: Array of 3-5 key takeaways or insights from the document
- keywords: Array of up to 10 searchable keywords/tags relevant to the content. IMPORTANT: Prefer using existing keywords from the database when semantically equivalent to avoid fragmentation.
- technologyAreas: Array of specific technology focus areas mentioned. IMPORTANT: Prefer using existing technology areas from the database when semantically equivalent to avoid fragmentation.

Respond ONLY with valid JSON, no other text:`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: "Failed to parse metadata from Claude response",
      };
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: {
        title: extractedData.title || "",
        company: extractedData.company || "",
        dateOrYear: validateYear(extractedData.dateOrYear),
        topic: extractedData.topic || "",
        summary: extractedData.summary || "",
        continent: validateContinent(extractedData.continent),
        industry: validateIndustry(extractedData.industry),
        documentType: validateDocumentType(extractedData.documentType),
        authors: validateStringArray(extractedData.authors, 10),
        keyFindings: validateStringArray(extractedData.keyFindings, 5),
        keywords: validateStringArray(extractedData.keywords, 10),
        technologyAreas: validateStringArray(extractedData.technologyAreas, 10),
      },
    };
  } catch (error) {
    console.error("PDF metadata extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate and extract year as integer from various input formats
 * Handles: number (2024), string ("2024"), date string ("2024-01-15"), etc.
 */
function validateYear(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1900 && value <= 2100) {
    return value;
  }

  if (typeof value === "string") {
    // Try to extract a 4-digit year from the string
    const yearMatch = value.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      if (year >= 1900 && year <= 2100) {
        return year;
      }
    }

    // Try parsing as a number directly
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2100) {
      return parsed;
    }
  }

  // Default to current year if no valid year found
  return new Date().getFullYear();
}

function validateContinent(value: string): "us" | "eu" | "asia" | "global" | "other" {
  const valid = ["us", "eu", "asia", "global", "other"];
  return valid.includes(value?.toLowerCase()) ? (value.toLowerCase() as "us" | "eu" | "asia" | "global" | "other") : "other";
}

function validateIndustry(value: string): "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other" {
  const valid = ["semicon", "deeptech", "biotech", "fintech", "cleantech", "other"];
  return valid.includes(value?.toLowerCase()) ? (value.toLowerCase() as "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other") : "other";
}

function validateDocumentType(value: string): "pitch_deck" | "market_research" | "financial_report" | "white_paper" | "case_study" | "annual_report" | "investor_update" | "other" {
  const valid = ["pitch_deck", "market_research", "financial_report", "white_paper", "case_study", "annual_report", "investor_update", "other"];
  const normalized = value?.toLowerCase().replace(/\s+/g, "_");
  return valid.includes(normalized) ? (normalized as "pitch_deck" | "market_research" | "financial_report" | "white_paper" | "case_study" | "annual_report" | "investor_update" | "other") : "other";
}

function validateStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map(item => item.trim());
}

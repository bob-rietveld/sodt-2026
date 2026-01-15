import Anthropic from "@anthropic-ai/sdk";

export interface PDFMetadata {
  title: string;
  company: string;
  dateOrYear: number;  // Year of publication as integer (e.g., 2024)
  topic: string;
  summary: string;
  continent: "us" | "eu" | "asia" | "global" | "other";
  industry: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other";
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

export interface TextExtractionResult {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
}

export interface MetadataExtractionResult {
  success: boolean;
  data?: PDFMetadata;
  error?: string;
}

/**
 * Extract text content from a PDF buffer using unpdf (serverless-compatible)
 * Note: We avoid using getDocumentProxy as it uses pdfjs-dist workers
 * which fail in serverless environments with "Cannot transfer object" errors
 *
 * Page markers are included in the format [Page X] to allow Pinecone to track
 * which page content came from for citation purposes.
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<TextExtractionResult> {
  try {
    // Dynamic import unpdf to avoid build-time issues
    const { extractText } = await import("unpdf");

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer);

    // Extract text from each page separately to preserve page boundaries
    const result = await extractText(uint8Array, { mergePages: false });

    if (!result.text || (Array.isArray(result.text) && result.text.length === 0)) {
      return {
        success: false,
        error: "No text content extracted from PDF",
      };
    }

    // Build text with page markers
    let textWithPageMarkers: string;
    if (Array.isArray(result.text)) {
      // When mergePages is false, result.text is an array of page texts
      textWithPageMarkers = result.text
        .map((pageText, index) => {
          const pageNum = index + 1;
          const trimmedText = pageText.trim();
          if (!trimmedText) return ""; // Skip empty pages
          return `[Page ${pageNum}]\n${trimmedText}`;
        })
        .filter(Boolean)
        .join("\n\n");
    } else {
      // Fallback if text is a single string (shouldn't happen with mergePages: false)
      textWithPageMarkers = `[Page 1]\n${result.text}`;
    }

    if (!textWithPageMarkers.trim()) {
      return {
        success: false,
        error: "No text content extracted from PDF",
      };
    }

    return {
      success: true,
      text: textWithPageMarkers,
      pageCount: result.totalPages,
    };
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during PDF text extraction",
    };
  }
}

/**
 * Extract text from a PDF URL by fetching and parsing locally
 */
export async function extractTextFromPdfUrl(pdfUrl: string): Promise<TextExtractionResult> {
  try {
    console.log("Fetching PDF from URL:", pdfUrl);
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch PDF: ${response.status} ${response.statusText}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("PDF fetched, size:", buffer.length, "bytes");

    return extractTextFromPdf(buffer);
  } catch (error) {
    console.error("PDF fetch/extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching PDF",
    };
  }
}

/**
 * Extract structured metadata from text content using Claude
 * This replaces the Firecrawl-based extraction
 * @param textContent - The text content to extract metadata from
 * @param context - Optional context with existing keywords and technology areas for consistency
 */
export async function extractMetadataFromText(
  textContent: string,
  context?: ExtractionContext
): Promise<MetadataExtractionResult> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    return {
      success: false,
      error: "ANTHROPIC_API_KEY must be set",
    };
  }

  if (!textContent || textContent.trim().length === 0) {
    return {
      success: false,
      error: "No text content provided for metadata extraction",
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Truncate content if too long (same as before - 15k chars)
    const truncatedContent = textContent.substring(0, 15000);

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
${truncatedContent}
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
    console.error("Metadata extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Combined function: Extract text from PDF buffer and then extract metadata
 * This is the main entry point replacing the Firecrawl-based extraction
 * @param pdfBuffer - The PDF buffer to extract from
 * @param context - Optional context with existing keywords and technology areas for consistency
 */
export async function extractPDFMetadataLocal(
  pdfBuffer: Buffer,
  context?: ExtractionContext
): Promise<MetadataExtractionResult & { extractedText?: string; pageCount?: number }> {
  // Step 1: Extract text from PDF
  console.log("Extracting text from PDF locally using unpdf...");
  const textResult = await extractTextFromPdf(pdfBuffer);

  if (!textResult.success || !textResult.text) {
    return {
      success: false,
      error: textResult.error || "Failed to extract text from PDF",
    };
  }

  console.log(`Text extracted successfully: ${textResult.text.length} chars, ${textResult.pageCount} pages`);

  // Step 2: Extract metadata from text using Claude
  console.log("Extracting metadata using Claude...");
  const metadataResult = await extractMetadataFromText(textResult.text, context);

  if (!metadataResult.success) {
    return metadataResult;
  }

  return {
    ...metadataResult,
    extractedText: textResult.text,
    pageCount: textResult.pageCount,
  };
}

/**
 * Extract metadata from a PDF URL (convenience function)
 * @param pdfUrl - The URL of the PDF to extract from
 * @param context - Optional context with existing keywords and technology areas for consistency
 */
export async function extractPDFMetadataFromUrl(
  pdfUrl: string,
  context?: ExtractionContext
): Promise<MetadataExtractionResult & { extractedText?: string; pageCount?: number }> {
  try {
    console.log("Fetching PDF from URL:", pdfUrl);
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch PDF: ${response.status} ${response.statusText}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("PDF fetched, size:", buffer.length, "bytes");

    return extractPDFMetadataLocal(buffer, context);
  } catch (error) {
    console.error("PDF metadata extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Validation helpers

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

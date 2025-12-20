import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

export interface PDFMetadata {
  title: string;
  company: string;
  dateOrYear: string;
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
 * Extract text content from a PDF buffer using pdf-parse
 * This is a local extraction that works for any file size
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<TextExtractionResult> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: pdfBuffer });
    const textResult = await parser.getText();

    if (!textResult.text || textResult.text.trim().length === 0) {
      return {
        success: false,
        error: "No text content extracted from PDF",
      };
    }

    return {
      success: true,
      text: textResult.text,
      pageCount: textResult.total,
    };
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during PDF text extraction",
    };
  } finally {
    if (parser) {
      await parser.destroy();
    }
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
 */
export async function extractMetadataFromText(textContent: string): Promise<MetadataExtractionResult> {
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

    const extractionPrompt = `Analyze the following document content and extract metadata in JSON format.

Document content:
${truncatedContent}

Extract the following fields:
- title: The title of the document or report
- company: The company name that authored or is the subject of the document
- dateOrYear: The date or year the document was published or refers to
- topic: A brief topic description (1 sentence, max 100 characters)
- summary: A comprehensive executive summary of the document (2-4 paragraphs, covering key findings, insights, and conclusions)
- continent: The geographic region (must be one of: "us", "eu", "asia", "global", "other")
- industry: The industry sector (must be one of: "semicon", "deeptech", "biotech", "fintech", "cleantech", "other")
- documentType: Type of document (must be one of: "pitch_deck", "market_research", "financial_report", "white_paper", "case_study", "annual_report", "investor_update", "other")
- authors: Array of author names found in the document (empty array if not found, max 10)
- keyFindings: Array of 3-5 key takeaways or insights from the document
- keywords: Array of up to 10 searchable keywords/tags relevant to the content
- technologyAreas: Array of specific technology focus areas mentioned (e.g., "AI", "Machine Learning", "IoT", "Blockchain", "Quantum Computing", "Robotics", "Cloud Computing")

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
        dateOrYear: extractedData.dateOrYear || "",
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
 */
export async function extractPDFMetadataLocal(pdfBuffer: Buffer): Promise<MetadataExtractionResult & { extractedText?: string; pageCount?: number }> {
  // Step 1: Extract text from PDF
  console.log("Extracting text from PDF locally...");
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
  const metadataResult = await extractMetadataFromText(textResult.text);

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
 */
export async function extractPDFMetadataFromUrl(pdfUrl: string): Promise<MetadataExtractionResult & { extractedText?: string; pageCount?: number }> {
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

    return extractPDFMetadataLocal(buffer);
  } catch (error) {
    console.error("PDF metadata extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Validation helpers
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

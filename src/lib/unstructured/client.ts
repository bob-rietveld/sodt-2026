import { UnstructuredClient } from "unstructured-client";
import { Strategy } from "unstructured-client/sdk/models/shared/partitionparameters";

let client: UnstructuredClient | null = null;

function getClient(): UnstructuredClient {
  if (client) return client;

  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    throw new Error("UNSTRUCTURED_API_KEY must be set");
  }

  client = new UnstructuredClient({
    security: { apiKeyAuth: apiKey },
  });

  return client;
}

export interface ExtractedChunk {
  text: string;
  pageNumber: number;
  elementType: string;
}

export interface ExtractionResult {
  chunks: ExtractedChunk[];
  metadata: {
    filename: string;
    pageCount: number;
    languages?: string[];
  };
}

export async function extractPdfFromUrl(
  fileUrl: string,
  filename: string
): Promise<ExtractionResult> {
  const unstructuredClient = getClient();

  // Fetch the file content
  const response = await fetch(fileUrl);
  const fileBuffer = await response.arrayBuffer();

  return extractPdfFromBuffer(Buffer.from(fileBuffer), filename);
}

export async function extractPdfFromBuffer(
  fileBuffer: Buffer,
  filename: string
): Promise<ExtractionResult> {
  const unstructuredClient = getClient();

  const response = await unstructuredClient.general.partition({
    partitionParameters: {
      files: {
        content: fileBuffer,
        fileName: filename,
      },
      strategy: Strategy.Auto,
      splitPdfPage: true,
      splitPdfConcurrencyLevel: 5,
    },
  });

  if (!response || typeof response === "string") {
    throw new Error("Failed to extract PDF: Invalid response");
  }

  const elements = response as Array<{ text?: string; type?: string; metadata?: { pageNumber?: number; languages?: string[] } }>;

  // Extract chunks with page numbers
  const chunks: ExtractedChunk[] = elements.map((element) => ({
    text: element.text || "",
    pageNumber: element.metadata?.pageNumber || 1,
    elementType: element.type || "unknown",
  }));

  // Calculate page count
  const pageNumbers = chunks.map((c) => c.pageNumber);
  const pageCount = Math.max(...pageNumbers, 1);

  // Detect languages if available
  const languages = elements
    .map((e) => e.metadata?.languages)
    .flat()
    .filter((l): l is string => !!l);
  const uniqueLanguages = [...new Set(languages)];

  return {
    chunks,
    metadata: {
      filename,
      pageCount,
      languages: uniqueLanguages.length > 0 ? uniqueLanguages : undefined,
    },
  };
}

// Combine small chunks into larger ones for better embedding
export function combineChunks(
  chunks: ExtractedChunk[],
  maxChunkSize: number = 1000
): ExtractedChunk[] {
  const combined: ExtractedChunk[] = [];
  let currentChunk: ExtractedChunk | null = null;

  for (const chunk of chunks) {
    if (!chunk.text.trim()) continue;

    if (!currentChunk) {
      currentChunk = { ...chunk };
    } else if (
      currentChunk.pageNumber === chunk.pageNumber &&
      currentChunk.text.length + chunk.text.length < maxChunkSize
    ) {
      currentChunk.text += "\n" + chunk.text;
    } else {
      combined.push(currentChunk);
      currentChunk = { ...chunk };
    }
  }

  if (currentChunk) {
    combined.push(currentChunk);
  }

  return combined;
}

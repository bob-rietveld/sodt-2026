import { VoyageAIClient } from "voyageai";

let client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (client) return client;

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY must be set");
  }

  client = new VoyageAIClient({ apiKey });
  return client;
}

export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  const voyageClient = getClient();

  const response = await voyageClient.embed({
    input: texts,
    model: "voyage-3",
    inputType,
  });

  if (!response.data) {
    throw new Error("No embeddings returned from Voyage AI");
  }

  return response.data.map((item) => item.embedding as number[]);
}

export async function embedQuery(query: string): Promise<number[]> {
  const embeddings = await embedTexts([query], "query");
  return embeddings[0];
}

export async function embedDocuments(documents: string[]): Promise<number[][]> {
  // Voyage AI has a limit on batch size, so we chunk if needed
  const BATCH_SIZE = 128;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTexts(batch, "document");
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

import weaviate, { WeaviateClient } from "weaviate-client";

let client: WeaviateClient | null = null;

export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (client) return client;

  const url = process.env.WEAVIATE_URL;
  const apiKey = process.env.WEAVIATE_API_KEY;

  if (!url || !apiKey) {
    throw new Error("WEAVIATE_URL and WEAVIATE_API_KEY must be set");
  }

  client = await weaviate.connectToWeaviateCloud(url, {
    authCredentials: new weaviate.ApiKey(apiKey),
  });

  return client;
}

export const PDF_COLLECTION_NAME = "PDFDocument";

export async function initializeCollection() {
  const client = await getWeaviateClient();

  // Check if collection exists
  const collections = await client.collections.listAll();
  const exists = collections.some((c) => c.name === PDF_COLLECTION_NAME);

  if (!exists) {
    await client.collections.create({
      name: PDF_COLLECTION_NAME,
      properties: [
        { name: "content", dataType: "text" },
        { name: "chunkIndex", dataType: "int" },
        { name: "pageNumber", dataType: "int" },
        { name: "convexId", dataType: "text" },
        { name: "filename", dataType: "text" },
        { name: "title", dataType: "text" },
      ],
      // No vectorizer - we'll provide vectors from Voyage AI
    });
  }

  return client;
}

export interface PDFChunk {
  content: string;
  chunkIndex: number;
  pageNumber: number;
  convexId: string;
  filename: string;
  title: string;
}

export async function insertChunks(
  chunks: PDFChunk[],
  vectors: number[][]
): Promise<string[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(PDF_COLLECTION_NAME);

  const ids: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await collection.data.insert({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: chunks[i] as any,
      vectors: vectors[i],
    });
    ids.push(result);
  }

  return ids;
}

export async function searchChunks(
  vector: number[],
  limit: number = 5
): Promise<Array<PDFChunk & { score: number }>> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(PDF_COLLECTION_NAME);

  const results = await collection.query.nearVector(vector, {
    limit,
    returnMetadata: ["distance"],
  });

  return results.objects.map((obj) => ({
    ...(obj.properties as unknown as PDFChunk),
    score: 1 - (obj.metadata?.distance ?? 0),
  }));
}

export async function hybridSearch(
  query: string,
  vector: number[],
  limit: number = 5
): Promise<Array<PDFChunk & { score: number }>> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(PDF_COLLECTION_NAME);

  const results = await collection.query.hybrid(query, {
    vector,
    limit,
    returnMetadata: ["score"],
  });

  return results.objects.map((obj) => ({
    ...(obj.properties as unknown as PDFChunk),
    score: obj.metadata?.score ?? 0,
  }));
}

export async function deleteByConvexId(convexId: string): Promise<void> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(PDF_COLLECTION_NAME);

  await collection.data.deleteMany(
    collection.filter.byProperty("convexId").equal(convexId)
  );
}

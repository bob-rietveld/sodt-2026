import {
  Pinecone,
  type AssistantFileModel,
  type StreamedChatResponse,
} from "@pinecone-database/pinecone";

const PINECONE_ASSISTANT_NAME = "sodt";
const PINECONE_MODEL = "gpt-4o";

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (pineconeClient) return pineconeClient;

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY must be set");
  }

  pineconeClient = new Pinecone({ apiKey });
  return pineconeClient;
}

export function getAssistant() {
  const pc = getPineconeClient();
  return pc.Assistant(PINECONE_ASSISTANT_NAME);
}

export interface FileMetadata {
  [key: string]: string;
}

export interface UploadFileResult {
  id: string;
  name: string;
  status: string;
  metadata?: FileMetadata;
  createdOn?: Date;
  updatedOn?: Date;
}

export async function uploadFile(
  filePath: string,
  metadata?: FileMetadata
): Promise<UploadFileResult> {
  const assistant = getAssistant();
  const result = await assistant.uploadFile({
    path: filePath,
    metadata,
  });

  return {
    id: result.id,
    name: result.name,
    status: result.status || "Processing",
    metadata: result.metadata as FileMetadata | undefined,
    createdOn: result.createdOn,
    updatedOn: result.updatedOn,
  };
}

export async function deleteFile(fileId: string): Promise<void> {
  const assistant = getAssistant();
  await assistant.deleteFile(fileId);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  citations?: Array<{
    position: number;
    references: Array<{
      file: {
        id: string;
        name: string;
      };
      pages?: number[];
    }>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function chat(messages: ChatMessage[]): Promise<ChatResponse> {
  const assistant = getAssistant();
  const response = await assistant.chat({
    messages,
    model: PINECONE_MODEL,
  });

  const citations = response.citations?.map((c) => ({
    position: c.position ?? 0,
    references: (c.references ?? []).map((r) => ({
      file: {
        id: r.file?.id ?? "",
        name: r.file?.name ?? "",
      },
      pages: r.pages,
    })),
  }));

  const usage = response.usage
    ? {
        promptTokens: response.usage.promptTokens ?? 0,
        completionTokens: response.usage.completionTokens ?? 0,
        totalTokens: response.usage.totalTokens ?? 0,
      }
    : undefined;

  return {
    id: response.id || "",
    content: response.message?.content || "",
    model: response.model || PINECONE_MODEL,
    citations,
    usage,
  };
}

export type { StreamedChatResponse as StreamChunk };

export async function* chatStream(
  messages: ChatMessage[]
): AsyncGenerator<StreamedChatResponse> {
  const assistant = getAssistant();
  const stream = await assistant.chatStream({
    messages,
    model: PINECONE_MODEL,
  });

  for await (const chunk of stream) {
    yield chunk;
  }
}

export interface FileInfo {
  id: string;
  name: string;
  status: string;
  percentDone?: number;
  metadata?: FileMetadata;
  createdOn?: Date;
  updatedOn?: Date;
  errorMessage?: string;
}

export interface ListFilesResult {
  files: FileInfo[];
}

function mapFileToInfo(file: AssistantFileModel): FileInfo {
  return {
    id: file.id,
    name: file.name,
    status: file.status || "Unknown",
    percentDone: file.percentDone ?? undefined,
    metadata: file.metadata as FileMetadata | undefined,
    createdOn: file.createdOn,
    updatedOn: file.updatedOn,
    errorMessage: file.errorMessage ?? undefined,
  };
}

export async function listFiles(
  filter?: FileMetadata
): Promise<ListFilesResult> {
  const assistant = getAssistant();
  const result = await assistant.listFiles({ filter });

  return {
    files: (result.files || []).map(mapFileToInfo),
  };
}

export async function describeFile(fileId: string): Promise<FileInfo> {
  const assistant = getAssistant();
  const file = await assistant.describeFile(fileId);

  return mapFileToInfo(file);
}

import {
  Pinecone,
  type AssistantFileModel,
  type StreamedChatResponse,
} from "@pinecone-database/pinecone";

const PINECONE_ASSISTANT_NAME = "sodt";
const PINECONE_MODEL = "gpt-4o";

// System prompt to encourage inline citations
const SYSTEM_INSTRUCTIONS = `You are a helpful assistant that answers questions about the State of Dutch Tech report and related documents.

When answering questions:
1. Use markdown formatting for better readability (headers, lists, bold, etc.)
2. Include inline citation numbers like [1], [2], etc. when referencing specific information from documents
3. Be specific about which document and page number contains each piece of information
4. Structure your response clearly with sections if the answer covers multiple topics
5. If you're unsure or the information isn't in the documents, say so clearly`;

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

export interface ChatFilter {
  fileIds?: string[];
}

export async function* chatStream(
  messages: ChatMessage[],
  filter?: ChatFilter
): AsyncGenerator<StreamedChatResponse> {
  const assistant = getAssistant();

  // Prepend system instructions as context for better formatting and citations
  const messagesWithInstructions: ChatMessage[] = [
    {
      role: "user",
      content: `[Instructions: ${SYSTEM_INSTRUCTIONS}]\n\nNow answer the following question:`,
    },
    {
      role: "assistant",
      content:
        "I understand. I will format my responses using markdown and include inline citation numbers [1], [2], etc. to reference specific documents. I'll be clear about sources.",
    },
    ...messages,
  ];

  // Build filter object if file IDs are provided
  const chatFilter = filter?.fileIds?.length
    ? { id: { $in: filter.fileIds } }
    : undefined;

  const stream = await assistant.chatStream({
    messages: messagesWithInstructions,
    model: PINECONE_MODEL,
    filter: chatFilter,
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

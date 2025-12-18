import { google, drive_v3 } from "googleapis";

let driveClient: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export async function getFile(fileId: string): Promise<DriveFile | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, createdTime, modifiedTime",
    });

    return response.data as DriveFile;
  } catch (error) {
    console.error("Error getting file from Drive:", error);
    return null;
  }
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function listPdfsInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: "files(id, name, mimeType, size, createdTime, modifiedTime)",
    orderBy: "createdTime desc",
  });

  return (response.data.files as DriveFile[]) || [];
}

// Set up watch on a folder for push notifications
export async function watchFolder(
  folderId: string,
  webhookUrl: string,
  channelId: string
): Promise<{ resourceId: string; expiration: string }> {
  const drive = getDriveClient();

  const response = await drive.files.watch({
    fileId: folderId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      // Watch expires after 1 week max
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    resourceId: response.data.resourceId || "",
    expiration: response.data.expiration || "",
  };
}

// Stop watching a channel
export async function stopWatching(
  channelId: string,
  resourceId: string
): Promise<void> {
  const drive = getDriveClient();

  await drive.channels.stop({
    requestBody: {
      id: channelId,
      resourceId,
    },
  });
}

// Verify webhook signature (basic validation)
export function verifyWebhookHeaders(headers: Headers): boolean {
  const channelId = headers.get("x-goog-channel-id");
  const resourceState = headers.get("x-goog-resource-state");

  // Basic validation - ensure required headers exist
  return !!channelId && !!resourceState;
}

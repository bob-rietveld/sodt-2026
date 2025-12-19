import { google, drive_v3 } from "googleapis";

let driveClient: drive_v3.Drive | null = null;
let oauth2DriveClient: drive_v3.Drive | null = null;

export interface DriveCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

// Service account client (for webhooks/read operations)
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

// OAuth2 client (for user-authorized uploads)
export function getOAuth2DriveClient(credentials: DriveCredentials): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  oauth2DriveClient = google.drive({ version: "v3", auth: oauth2Client });
  return oauth2DriveClient;
}

// Get OAuth2 client from settings
export async function getOAuth2ClientFromSettings(
  settings: Record<string, string>
): Promise<drive_v3.Drive | null> {
  const clientId = settings.google_client_id;
  const clientSecret = settings.google_client_secret;
  const refreshToken = settings.google_refresh_token;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return getOAuth2DriveClient({
    clientId,
    clientSecret,
    refreshToken,
  });
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

// Upload a file to Google Drive using OAuth2 credentials
export async function uploadToDrive(
  file: Buffer,
  filename: string,
  mimeType: string,
  folderId: string | undefined,
  credentials: DriveCredentials
): Promise<DriveUploadResult> {
  try {
    const drive = getOAuth2DriveClient(credentials);

    const { Readable } = await import("stream");
    const stream = Readable.from(file);

    const fileMetadata: drive_v3.Schema$File = {
      name: filename,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: stream,
      },
      fields: "id, webViewLink",
    });

    return {
      success: true,
      fileId: response.data.id || undefined,
      webViewLink: response.data.webViewLink || undefined,
    };
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

// List folders in Google Drive (for folder selection)
export async function listDriveFolders(
  credentials: DriveCredentials,
  parentId?: string
): Promise<DriveFolder[]> {
  try {
    const drive = getOAuth2DriveClient(credentials);

    let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += " and 'root' in parents";
    }

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      orderBy: "name",
      pageSize: 100,
    });

    return (response.data.files || []).map((file) => ({
      id: file.id || "",
      name: file.name || "",
    }));
  } catch (error) {
    console.error("Failed to list Drive folders:", error);
    return [];
  }
}

// Generate OAuth2 authorization URL
export function getGoogleAuthUrl(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): string {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
    prompt: "consent",
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ refreshToken?: string; accessToken?: string; error?: string }> {
  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    return {
      refreshToken: tokens.refresh_token || undefined,
      accessToken: tokens.access_token || undefined,
    };
  } catch (error) {
    console.error("Token exchange error:", error);
    return {
      error: error instanceof Error ? error.message : "Token exchange failed",
    };
  }
}

// Test Drive connection
export async function testDriveConnection(credentials: DriveCredentials): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const drive = getOAuth2DriveClient(credentials);

    const about = await drive.about.get({
      fields: "user(emailAddress)",
    });

    return {
      success: true,
      email: about.data.user?.emailAddress || undefined,
    };
  } catch (error) {
    console.error("Drive connection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

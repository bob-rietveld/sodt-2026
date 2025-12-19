"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";

interface DriveFolder {
  id: string;
  name: string;
}

export default function SettingsContent() {
  const searchParams = useSearchParams();
  const settings = useQuery(api.settings.getAll);
  const setSetting = useMutation(api.settings.set);

  // Unstructured settings
  const [workflowId, setWorkflowId] = useState("");

  // Embedding provider settings
  const [embeddingProvider, setEmbeddingProvider] = useState<"unstructured" | "voyage">("voyage");

  // Google Drive settings
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFolderName, setSelectedFolderName] = useState("");
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);

  // General state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load saved settings
  useEffect(() => {
    if (settings) {
      setWorkflowId(settings.unstructured_workflow_id || "");
      setEmbeddingProvider((settings.embedding_provider as "unstructured" | "voyage") || "voyage");
      setGoogleClientId(settings.google_client_id || "");
      setGoogleClientSecret(settings.google_client_secret || "");
      setSelectedFolderId(settings.google_drive_folder_id || "");
      setSelectedFolderName(settings.google_drive_folder_name || "");

      // Check if Drive is connected
      if (settings.google_refresh_token) {
        testDriveConnection();
      }
    }
  }, [settings]);

  // Handle URL params for OAuth callback
  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get("success");

    if (error) {
      setSaveMessage({ type: "error", text: decodeURIComponent(error) });
      // Clear URL params after showing message
      window.history.replaceState({}, "", "/admin/settings");
    } else if (success && settings) {
      // Only process success when settings are loaded
      setSaveMessage({ type: "success", text: decodeURIComponent(success) });
      testDriveConnection();
      // Clear URL params after processing
      window.history.replaceState({}, "", "/admin/settings");
    }
  }, [searchParams, settings]);

  const testDriveConnection = async () => {
    try {
      const response = await fetch("/api/google-drive/folders", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setDriveConnected(true);
        setDriveEmail(data.email || null);
        loadFolders();
      } else {
        setDriveConnected(false);
        setDriveEmail(null);
      }
    } catch {
      setDriveConnected(false);
      setDriveEmail(null);
    }
  };

  const loadFolders = async (parentId?: string) => {
    setIsLoadingFolders(true);
    try {
      const url = parentId
        ? `/api/google-drive/folders?parentId=${parentId}`
        : "/api/google-drive/folders";
      const response = await fetch(url);
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Failed to load folders:", error);
      setFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setSetting({
        key: "unstructured_workflow_id",
        value: workflowId.trim(),
      });
      setSaveMessage({ type: "success", text: "Workflow settings saved!" });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmbeddingProvider = async (provider: "unstructured" | "voyage") => {
    setEmbeddingProvider(provider);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setSetting({
        key: "embedding_provider",
        value: provider,
      });
      setSaveMessage({ type: "success", text: `Embedding provider set to ${provider === "voyage" ? "Voyage AI" : "Unstructured.io"}!` });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGoogleCredentials = async () => {
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      setSaveMessage({ type: "error", text: "Please enter both Client ID and Client Secret" });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setSetting({ key: "google_client_id", value: googleClientId.trim() });
      await setSetting({ key: "google_client_secret", value: googleClientSecret.trim() });
      setSaveMessage({ type: "success", text: "Google credentials saved! Click 'Connect' to authorize." });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      setSaveMessage({ type: "error", text: "Please enter Client ID and Client Secret" });
      return;
    }

    try {
      // Save credentials first before redirecting
      setSaveMessage(null);
      await setSetting({ key: "google_client_id", value: googleClientId.trim() });
      await setSetting({ key: "google_client_secret", value: googleClientSecret.trim() });

      const response = await fetch("/api/google-drive/auth-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: googleClientId.trim(),
          clientSecret: googleClientSecret.trim(),
        }),
      });

      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to generate auth URL" });
      }
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to connect",
      });
    }
  };

  const handleSelectFolder = async (folder: DriveFolder) => {
    setSelectedFolderId(folder.id);
    setSelectedFolderName(folder.name);

    try {
      await setSetting({ key: "google_drive_folder_id", value: folder.id });
      await setSetting({ key: "google_drive_folder_name", value: folder.name });
      setSaveMessage({ type: "success", text: `Folder "${folder.name}" selected!` });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save folder",
      });
    }
  };

  const handleNavigateToFolder = (folder: DriveFolder) => {
    setFolderPath([...folderPath, folder]);
    loadFolders(folder.id);
  };

  const handleNavigateBack = (index: number) => {
    if (index === -1) {
      // Go to root
      setFolderPath([]);
      loadFolders();
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      loadFolders(newPath[newPath.length - 1].id);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect Google Drive?")) {
      return;
    }

    try {
      await setSetting({ key: "google_refresh_token", value: "" });
      await setSetting({ key: "google_drive_folder_id", value: "" });
      await setSetting({ key: "google_drive_folder_name", value: "" });
      setDriveConnected(false);
      setDriveEmail(null);
      setFolders([]);
      setFolderPath([]);
      setSelectedFolderId("");
      setSelectedFolderName("");
      setSaveMessage({ type: "success", text: "Google Drive disconnected" });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to disconnect",
      });
    }
  };

  // Show loading state while settings are being fetched
  if (settings === undefined) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-foreground/50">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Settings</h1>

      {/* Message */}
      {saveMessage && (
        <div
          className={`p-4 rounded-lg max-w-2xl ${
            saveMessage.type === "success"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Google Drive Settings */}
      <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">Google Drive</h2>

        {/* Setup Instructions */}
        {!driveConnected && (
          <div className="mb-6 p-4 bg-info/5 border border-info/20 rounded-lg">
            <h3 className="text-sm font-semibold text-info mb-2">Setup Instructions</h3>
            <ol className="text-sm text-foreground/70 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
              <li>Create or select a project</li>
              <li>Enable the Google Drive API</li>
              <li>Create OAuth 2.0 credentials (Web application)</li>
              <li>Add this redirect URI: <code className="bg-foreground/10 px-2 py-0.5 rounded text-xs">{typeof window !== "undefined" ? `${window.location.origin}/api/google-drive/callback` : "/api/google-drive/callback"}</code></li>
              <li>Copy the Client ID and Client Secret below</li>
            </ol>
          </div>
        )}

        {/* Connection Status */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${
              driveConnected ? "bg-success" : "bg-foreground/30"
            }`}
          />
          <span className={driveConnected ? "text-success" : "text-foreground/50"}>
            {driveConnected
              ? `Connected${driveEmail ? ` as ${driveEmail}` : ""}`
              : "Not connected"}
          </span>
        </div>

        <div className="space-y-4">
          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">
              Client ID
            </label>
            <input
              type="text"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="Your Google OAuth Client ID"
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">
              Client Secret
            </label>
            <input
              type="password"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              placeholder="Your Google OAuth Client Secret"
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleSaveGoogleCredentials}
              disabled={isSaving}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save Credentials
            </button>
            <button
              onClick={handleConnectGoogle}
              disabled={!googleClientId || !googleClientSecret}
              className="px-6 py-3 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              {driveConnected ? "Reconnect" : "Connect to Google"}
            </button>
            {driveConnected && (
              <button
                onClick={handleDisconnectGoogle}
                className="px-6 py-3 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Folder Selection */}
          {driveConnected && (
            <div className="pt-6 border-t border-foreground/10">
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                Upload Folder
              </label>

              {selectedFolderId && (
                <div className="mb-3 px-4 py-2 bg-success/10 text-success rounded-lg inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  {selectedFolderName || selectedFolderId}
                </div>
              )}

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 mb-2 text-sm">
                <button
                  onClick={() => handleNavigateBack(-1)}
                  className="text-primary hover:underline"
                >
                  My Drive
                </button>
                {folderPath.map((folder, index) => (
                  <span key={folder.id} className="flex items-center gap-1">
                    <span className="text-foreground/30">/</span>
                    <button
                      onClick={() => handleNavigateBack(index)}
                      className="text-primary hover:underline"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              <div className="border border-foreground/10 rounded-lg max-h-60 overflow-y-auto">
                {isLoadingFolders ? (
                  <div className="p-4 text-center text-foreground/50">Loading folders...</div>
                ) : folders.length === 0 ? (
                  <div className="p-4 text-center text-foreground/50">
                    {folderPath.length > 0 ? (
                      <div>
                        <p>No subfolders in this folder</p>
                        <button
                          onClick={() => handleSelectFolder({
                            id: folderPath[folderPath.length - 1].id,
                            name: folderPath[folderPath.length - 1].name
                          })}
                          className="mt-2 text-primary hover:underline"
                        >
                          Select this folder
                        </button>
                      </div>
                    ) : (
                      "No folders found"
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-foreground/5">
                    {folders.map((folder) => (
                      <li key={folder.id}>
                        <div
                          className={`w-full px-4 py-3 flex items-center gap-3 ${
                            selectedFolderId === folder.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-foreground/40 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          <span className="flex-1">{folder.name}</span>
                          {selectedFolderId === folder.id && (
                            <svg
                              className="w-5 h-5 text-success flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleSelectFolder(folder)}
                              className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => handleNavigateToFolder(folder)}
                              className="px-3 py-1 text-xs bg-foreground/10 text-foreground/70 rounded hover:bg-foreground/20 transition-colors"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => {
                  const parentId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : undefined;
                  loadFolders(parentId);
                }}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Refresh folders
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Embedding Provider Settings */}
      <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">Embedding Provider</h2>
        <p className="text-foreground/70 mb-4">
          Choose which service to use for generating vector embeddings from your documents.
        </p>

        <div className="space-y-3">
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              embeddingProvider === "voyage"
                ? "border-primary bg-primary/5"
                : "border-foreground/10 hover:border-foreground/20"
            }`}
          >
            <input
              type="radio"
              name="embeddingProvider"
              value="voyage"
              checked={embeddingProvider === "voyage"}
              onChange={() => handleSaveEmbeddingProvider("voyage")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Voyage AI</div>
              <div className="text-sm text-foreground/60">
                High-quality embeddings optimized for retrieval. Requires <code className="bg-foreground/10 px-1 rounded">VOYAGE_API_KEY</code> environment variable.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              embeddingProvider === "unstructured"
                ? "border-primary bg-primary/5"
                : "border-foreground/10 hover:border-foreground/20"
            }`}
          >
            <input
              type="radio"
              name="embeddingProvider"
              value="unstructured"
              checked={embeddingProvider === "unstructured"}
              onChange={() => handleSaveEmbeddingProvider("unstructured")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Unstructured.io</div>
              <div className="text-sm text-foreground/60">
                Built-in embeddings from the Unstructured workflow. Uses the configured workflow for both extraction and embedding.
              </div>
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              embeddingProvider === "voyage" ? "bg-success" : "bg-info"
            }`}
          />
          <span className="text-foreground/60">
            Currently using: <span className="font-medium">{embeddingProvider === "voyage" ? "Voyage AI" : "Unstructured.io"}</span>
          </span>
        </div>
      </div>

      {/* Unstructured Workflow Settings */}
      <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">Unstructured Workflow</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="workflowId"
              className="block text-sm font-medium text-foreground/70 mb-2"
            >
              Workflow ID
            </label>
            <input
              type="text"
              id="workflowId"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="Enter your Unstructured workflow ID"
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-2 text-sm text-foreground/50">
              Find your workflow ID in the Unstructured Platform dashboard under Workflows.
            </p>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save Workflow Settings
            </button>
          </div>
        </div>
      </div>

      {/* Environment Variables */}
      <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        <p className="text-foreground/70 mb-4">
          Make sure you have set the following environment variables:
        </p>
        <div className="bg-foreground/5 rounded-lg p-4 font-mono text-sm space-y-2">
          <div>
            <span className="text-primary">UNSTRUCTURED_API_URL</span>=
            <span className="text-foreground/50">your-api-url</span>
          </div>
          <div>
            <span className="text-primary">UNSTRUCTURED_API_KEY</span>=
            <span className="text-foreground/50">your-api-key</span>
          </div>
          <div>
            <span className="text-primary">VOYAGE_API_KEY</span>=
            <span className="text-foreground/50">your-voyage-key</span>
            <span className="text-foreground/40 text-xs ml-2">(if using Voyage AI)</span>
          </div>
          <div>
            <span className="text-primary">FIRECRAWL_API_KEY</span>=
            <span className="text-foreground/50">your-firecrawl-key</span>
            <span className="text-foreground/40 text-xs ml-2">(for PDF metadata extraction)</span>
          </div>
          <div>
            <span className="text-primary">ANTHROPIC_API_KEY</span>=
            <span className="text-foreground/50">your-anthropic-key</span>
            <span className="text-foreground/40 text-xs ml-2">(for chat & extraction)</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-foreground/50">
          Note: Google Drive credentials are stored securely in the database instead of environment variables.
        </p>
      </div>
    </div>
  );
}

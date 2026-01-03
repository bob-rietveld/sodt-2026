"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { SettingsTabs } from "@/components/ui/settings-tabs";

interface DriveFolder {
  id: string;
  name: string;
}

type TabId = "processing" | "integrations" | "environment";

const TABS = [
  {
    id: "processing" as TabId,
    label: "Processing",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    id: "integrations" as TabId,
    label: "Integrations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
  },
  {
    id: "environment" as TabId,
    label: "Environment",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

export default function SettingsContent() {
  const searchParams = useSearchParams();
  const settings = useQuery(api.settings.getAll);
  const setSetting = useMutation(api.settings.set);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("processing");

  // Processing pipeline settings
  const [processingEnabled, setProcessingEnabled] = useState(true);
  const [metadataExtractionEnabled, setMetadataExtractionEnabled] = useState(true);

  // Unstructured settings
  const [workflowId, setWorkflowId] = useState("");


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
      setProcessingEnabled(settings.processing_enabled !== "false"); // Default to true
      setMetadataExtractionEnabled(settings.metadata_extraction_enabled !== "false"); // Default to true
      setWorkflowId(settings.unstructured_workflow_id || "");
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

  const handleToggleProcessing = async (enabled: boolean) => {
    setProcessingEnabled(enabled);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setSetting({
        key: "processing_enabled",
        value: enabled ? "true" : "false",
      });
      setSaveMessage({
        type: "success",
        text: enabled
          ? "Processing pipeline enabled. Uploads will be processed and indexed."
          : "Processing pipeline disabled. Uploads will be stored but not indexed for search.",
      });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
      setProcessingEnabled(!enabled); // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMetadataExtraction = async (enabled: boolean) => {
    setMetadataExtractionEnabled(enabled);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await setSetting({
        key: "metadata_extraction_enabled",
        value: enabled ? "true" : "false",
      });
      setSaveMessage({
        type: "success",
        text: enabled
          ? "Metadata extraction enabled. Firecrawl will extract title, company, summary, etc."
          : "Metadata extraction disabled. PDFs will be uploaded without automatic metadata.",
      });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save",
      });
      setMetadataExtractionEnabled(!enabled); // Revert on error
    } finally {
      setIsSaving(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-foreground/60 mt-1">
          Configure processing options and external integrations
        </p>
      </div>

      {/* Tabs */}
      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabId)}
      />

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

      {/* Processing Tab */}
      {activeTab === "processing" && (
        <div className="space-y-6">
          {/* Processing Pipeline Settings */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Processing Pipeline</h2>
            <p className="text-foreground/70 mb-4">
              Control whether uploaded PDFs are processed and indexed for search. When disabled,
              PDFs will still be stored but won&apos;t be searchable via semantic search or chat.
            </p>

            <div className="flex items-center justify-between p-4 rounded-lg border border-foreground/10">
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    processingEnabled ? "bg-success" : "bg-foreground/30"
                  }`}
                />
                <div>
                  <div className="font-medium">
                    {processingEnabled ? "Processing Enabled" : "Processing Disabled"}
                  </div>
                  <div className="text-sm text-foreground/60">
                    {processingEnabled
                      ? "Uploads will be extracted and indexed in Pinecone Assistant"
                      : "Uploads will be stored only (no extraction or indexing)"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleToggleProcessing(!processingEnabled)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 ${
                  processingEnabled ? "bg-success" : "bg-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    processingEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {!processingEnabled && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="text-sm text-warning">
                    <strong>Note:</strong> With processing disabled, new uploads will not appear in search results
                    or be available for chat. You can enable processing later and manually reprocess PDFs.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata Extraction Settings */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Metadata Extraction</h2>
            <p className="text-foreground/70 mb-4">
              Control whether Firecrawl extracts metadata (title, company, summary, industry, region) from uploaded PDFs.
              When disabled, PDFs will use filename-based titles only.
            </p>

            <div className="flex items-center justify-between p-4 rounded-lg border border-foreground/10">
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    metadataExtractionEnabled ? "bg-success" : "bg-foreground/30"
                  }`}
                />
                <div>
                  <div className="font-medium">
                    {metadataExtractionEnabled ? "Extraction Enabled" : "Extraction Disabled"}
                  </div>
                  <div className="text-sm text-foreground/60">
                    {metadataExtractionEnabled
                      ? "Firecrawl will extract title, company, summary, industry, and region"
                      : "PDFs will be stored with filename-based titles only"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleToggleMetadataExtraction(!metadataExtractionEnabled)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 ${
                  metadataExtractionEnabled ? "bg-success" : "bg-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    metadataExtractionEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {metadataExtractionEnabled && (
              <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-info flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="text-sm text-info">
                    <strong>Note:</strong> Metadata extraction uses Firecrawl API credits. Each PDF counts as one extraction request.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
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
        </div>
      )}

      {/* Environment Tab */}
      {activeTab === "environment" && (
        <div className="space-y-6">
          {/* Environment Variables */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Required Environment Variables</h2>
            <p className="text-foreground/70 mb-4">
              Make sure you have set the following environment variables in your deployment:
            </p>
            <div className="bg-foreground/5 rounded-lg p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-primary">PINECONE_API_KEY</span>=
                <span className="text-foreground/50">your-pinecone-key</span>
                <span className="text-foreground/40 text-xs ml-2">(for document indexing & chat)</span>
              </div>
              <div>
                <span className="text-primary">FIRECRAWL_API_KEY</span>=
                <span className="text-foreground/50">your-firecrawl-key</span>
                <span className="text-foreground/40 text-xs ml-2">(for PDF metadata extraction)</span>
              </div>
              <div>
                <span className="text-primary">ANTHROPIC_API_KEY</span>=
                <span className="text-foreground/50">your-anthropic-key</span>
                <span className="text-foreground/40 text-xs ml-2">(for metadata extraction)</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-foreground/50">
              Note: Google Drive credentials are stored securely in the database instead of environment variables.
            </p>
          </div>

          {/* Additional info */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Configuration Notes</h2>
            <ul className="text-foreground/70 space-y-2 list-disc list-inside">
              <li>Environment variables should be set in your hosting provider&apos;s dashboard</li>
              <li>Changes to environment variables require a redeployment to take effect</li>
              <li>Never commit environment variables to source control</li>
              <li>Use separate API keys for development and production environments</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

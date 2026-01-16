"use client";

import { useState } from "react";

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description?: string) => Promise<void>;
  editMode?: {
    name: string;
    description?: string;
  };
}

export function CreateDashboardModal({
  isOpen,
  onClose,
  onConfirm,
  editMode,
}: CreateDashboardModalProps) {
  const [name, setName] = useState(editMode?.name || "");
  const [description, setDescription] = useState(editMode?.description || "");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onConfirm(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      onClose();
    } catch (error) {
      console.error("Failed to save dashboard:", error);
      alert("Failed to save dashboard. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName("");
      setDescription("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">
          {editMode ? "Edit Dashboard" : "Create New Dashboard"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="dashboard-name"
              className="block text-sm font-medium mb-2"
            >
              Dashboard Name
            </label>
            <input
              id="dashboard-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Executive Summary"
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:border-primary"
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="dashboard-description"
              className="block text-sm font-medium mb-2"
            >
              Description (optional)
            </label>
            <textarea
              id="dashboard-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this dashboard..."
              rows={3}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:border-primary resize-none"
              disabled={isCreating}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating
                ? editMode
                  ? "Saving..."
                  : "Creating..."
                : editMode
                  ? "Save Changes"
                  : "Create Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

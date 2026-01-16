"use client";

import { useState } from "react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, color?: string) => Promise<void>;
}

const FOLDER_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
];

export function CreateFolderModal({
  isOpen,
  onClose,
  onConfirm,
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onConfirm(name.trim(), selectedColor);
      setName("");
      setSelectedColor(undefined);
      onClose();
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Failed to create folder. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName("");
      setSelectedColor(undefined);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Create New Folder</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="folder-name"
              className="block text-sm font-medium mb-2"
            >
              Folder Name
            </label>
            <input
              id="folder-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Reports"
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:border-primary"
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Color (optional)
            </label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() =>
                    setSelectedColor(
                      selectedColor === color.value ? undefined : color.value
                    )
                  }
                  className={`w-8 h-8 rounded-full transition-transform ${
                    selectedColor === color.value
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                  disabled={isCreating}
                />
              ))}
            </div>
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
              {isCreating ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

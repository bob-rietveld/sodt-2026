"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PDF } from "@/types";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";

export default function PdfsContent() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });

  const pdfs = useQuery(
    api.pdfs.list,
    filter === "all" ? {} : { status: filter as "pending" | "processing" | "completed" | "failed" }
  );

  const updatePdf = useMutation(api.pdfs.update);
  const removePdf = useMutation(api.pdfs.remove);
  const approvePdf = useMutation(api.pdfs.approve);

  const handleEdit = (pdf: PDF) => {
    setEditingId(pdf._id);
    setEditForm({
      title: pdf.title,
      description: pdf.description || "",
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updatePdf({
      id: editingId,
      title: editForm.title,
      description: editForm.description || undefined,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await removePdf({ id });
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      const response = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId: id, action: "reprocess" }),
      });
      if (response.ok) {
        alert("Reprocessing started");
      }
    } catch (error) {
      console.error("Reprocess error:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">PDF Management</h1>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(["all", "pending", "processing", "completed", "failed"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? "bg-primary text-white"
                    : "bg-white text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-foreground/5">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Title
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Status
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Approved
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Source
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pdfs?.map((pdf: PDF) => (
              <tr key={pdf._id} className="border-t border-foreground/5">
                <td className="px-6 py-4">
                  {editingId === pdf._id ? (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded"
                    />
                  ) : (
                    <div>
                      <div className="font-medium">{pdf.title}</div>
                      <div className="text-sm text-foreground/50">
                        {pdf.filename}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pdf.status === "completed"
                        ? "bg-success/10 text-success"
                        : pdf.status === "failed"
                          ? "bg-danger/10 text-danger"
                          : pdf.status === "processing"
                            ? "bg-info/10 text-info"
                            : "bg-foreground/10 text-foreground/60"
                    }`}
                  >
                    {pdf.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pdf.approved
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {pdf.approved ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-foreground/70">
                  {pdf.source}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {editingId === pdf._id ? (
                      <>
                        <button
                          onClick={handleSave}
                          className="text-sm text-success hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm text-foreground/50 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(pdf)}
                          className="text-sm text-info hover:underline"
                        >
                          Edit
                        </button>
                        {!pdf.approved && (
                          <button
                            onClick={() =>
                              approvePdf({ id: pdf._id, approvedBy: "admin" })
                            }
                            className="text-sm text-success hover:underline"
                          >
                            Approve
                          </button>
                        )}
                        {pdf.status === "failed" && (
                          <button
                            onClick={() => handleReprocess(pdf._id)}
                            className="text-sm text-warning hover:underline"
                          >
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(pdf._id)}
                          className="text-sm text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!pdfs || pdfs.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-foreground/50"
                >
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

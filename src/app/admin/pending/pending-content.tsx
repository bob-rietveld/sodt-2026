"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PDF } from "@/types";

export default function PendingContent() {
  const allPdfs = useQuery(api.pdfs.list, {});
  const pendingPdfs = allPdfs?.filter((p: PDF) => !p.approved && p.status === "completed");

  const approvePdf = useMutation(api.pdfs.approve);
  const rejectPdf = useMutation(api.pdfs.reject);
  const removePdf = useMutation(api.pdfs.remove);

  const handleApprove = async (id: string) => {
    await approvePdf({ id, approvedBy: "admin" });
  };

  const handleReject = async (id: string) => {
    await rejectPdf({ id });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await removePdf({ id });
    }
  };

  const handleApproveAll = async () => {
    if (!pendingPdfs || pendingPdfs.length === 0) return;
    if (!confirm(`Approve all ${pendingPdfs.length} documents?`)) return;

    for (const pdf of pendingPdfs) {
      await approvePdf({ id: pdf._id, approvedBy: "admin" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">Pending Approval</h1>
        {pendingPdfs && pendingPdfs.length > 0 && (
          <button
            onClick={handleApproveAll}
            className="px-6 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors"
          >
            Approve All ({pendingPdfs.length})
          </button>
        )}
      </div>

      <div className="space-y-4">
        {pendingPdfs?.map((pdf: PDF) => (
          <div
            key={pdf._id}
            className="bg-white p-6 rounded-xl border border-foreground/10"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">{pdf.title}</h3>
                {pdf.description && (
                  <p className="text-foreground/70 mb-4">{pdf.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm text-foreground/50">
                  <span>{pdf.filename}</span>
                  {pdf.pageCount && <span>{pdf.pageCount} pages</span>}
                  <span>
                    Source: {pdf.source === "drive" ? "Google Drive" : "Upload"}
                  </span>
                  <span>
                    Uploaded:{" "}
                    {new Date(pdf.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-6">
                <button
                  onClick={() => handleApprove(pdf._id)}
                  className="px-4 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(pdf._id)}
                  className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleDelete(pdf._id)}
                  className="px-4 py-2 bg-danger/10 text-danger rounded-lg font-medium hover:bg-danger/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!pendingPdfs || pendingPdfs.length === 0) && (
          <div className="bg-white p-12 rounded-xl border border-foreground/10 text-center">
            <svg
              className="w-16 h-16 text-success mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
            <p className="text-foreground/50">
              No documents pending approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

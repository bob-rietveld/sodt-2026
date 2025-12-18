"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

// Type for PDF documents (matches Convex schema)
interface PDF {
  _id: string;
  title: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  approved: boolean;
}

export default function DashboardContent() {
  const allPdfs = useQuery(api.pdfs.list, {});
  const pendingPdfs = useQuery(api.pdfs.list, { approvedOnly: false });
  const activeJobs = useQuery(api.processing.getActiveJobs);
  const failedJobs = useQuery(api.processing.getFailedJobs);

  const stats = {
    total: allPdfs?.length ?? 0,
    pending: pendingPdfs?.filter((p: { approved: boolean }) => !p.approved).length ?? 0,
    processing: activeJobs?.length ?? 0,
    failed: failedJobs?.length ?? 0,
    completed: allPdfs?.filter((p: { status: string }) => p.status === "completed").length ?? 0,
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <Link
          href="/admin/pdfs"
          className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-primary/20 transition-colors"
        >
          <div className="text-4xl font-semibold text-primary mb-2">
            {stats.total}
          </div>
          <div className="text-foreground/60">Total Documents</div>
        </Link>

        <Link
          href="/admin/pending"
          className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-warning/20 transition-colors"
        >
          <div className="text-4xl font-semibold text-warning mb-2">
            {stats.pending}
          </div>
          <div className="text-foreground/60">Pending Approval</div>
        </Link>

        <Link
          href="/admin/status"
          className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-info/20 transition-colors"
        >
          <div className="text-4xl font-semibold text-info mb-2">
            {stats.processing}
          </div>
          <div className="text-foreground/60">Processing</div>
        </Link>

        <Link
          href="/admin/status"
          className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-danger/20 transition-colors"
        >
          <div className="text-4xl font-semibold text-danger mb-2">
            {stats.failed}
          </div>
          <div className="text-foreground/60">Failed Jobs</div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-foreground/10 p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Documents</h2>
        <div className="space-y-4">
          {allPdfs?.slice(0, 5).map((pdf: PDF) => (
            <div
              key={pdf._id}
              className="flex items-center justify-between py-3 border-b border-foreground/5 last:border-0"
            >
              <div>
                <div className="font-medium">{pdf.title}</div>
                <div className="text-sm text-foreground/50">{pdf.filename}</div>
              </div>
              <div className="flex items-center gap-4">
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
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    pdf.approved
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {pdf.approved ? "Approved" : "Pending"}
                </span>
              </div>
            </div>
          ))}
          {(!allPdfs || allPdfs.length === 0) && (
            <div className="text-center py-8 text-foreground/50">
              No documents yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

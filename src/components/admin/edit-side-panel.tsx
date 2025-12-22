"use client";

import { useState, useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { PDF } from "@/types";

interface EditPropertiesForm {
  title: string;
  company: string;
  dateOrYear: string;
  topic: string;
  summary: string;
  continent: "us" | "eu" | "asia" | "global" | "other" | "";
  industry: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other" | "";
  documentType: "pitch_deck" | "market_research" | "financial_report" | "white_paper" | "case_study" | "annual_report" | "investor_update" | "other" | "";
  authors: string;
  keyFindings: string;
  keywords: string;
  technologyAreas: string;
}

const CONTINENT_OPTIONS = [
  { value: "", label: "Select Region" },
  { value: "us", label: "United States" },
  { value: "eu", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "global", label: "Global" },
  { value: "other", label: "Other" },
] as const;

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select Industry" },
  { value: "semicon", label: "Semiconductor" },
  { value: "deeptech", label: "Deep Tech" },
  { value: "biotech", label: "Biotech" },
  { value: "fintech", label: "Fintech" },
  { value: "cleantech", label: "Cleantech" },
  { value: "other", label: "Other" },
] as const;

const DOCUMENT_TYPE_OPTIONS = [
  { value: "", label: "Select Type" },
  { value: "pitch_deck", label: "Pitch Deck" },
  { value: "market_research", label: "Market Research" },
  { value: "financial_report", label: "Financial Report" },
  { value: "white_paper", label: "White Paper" },
  { value: "case_study", label: "Case Study" },
  { value: "annual_report", label: "Annual Report" },
  { value: "investor_update", label: "Investor Update" },
  { value: "other", label: "Other" },
] as const;

interface EditSidePanelProps {
  pdf: PDF;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: Id<"pdfs">, form: EditPropertiesForm) => Promise<void>;
  onSaveAndApprove?: (id: Id<"pdfs">, form: EditPropertiesForm) => Promise<void>;
  onRegenerateThumbnail?: (pdf: PDF) => Promise<void>;
  showApproveButton?: boolean;
}

export default function EditSidePanel({
  pdf,
  isOpen,
  onClose,
  onSave,
  onSaveAndApprove,
  onRegenerateThumbnail,
  showApproveButton = false,
}: EditSidePanelProps) {
  const [form, setForm] = useState<EditPropertiesForm>(() => ({
    title: pdf.title || "",
    company: pdf.company || "",
    dateOrYear: pdf.dateOrYear?.toString() || "",
    topic: pdf.topic || "",
    summary: pdf.summary || "",
    continent: pdf.continent || "",
    industry: pdf.industry || "",
    documentType: pdf.documentType || "",
    authors: pdf.authors?.join(", ") || "",
    keyFindings: pdf.keyFindings?.join("\n") || "",
    keywords: pdf.keywords?.join(", ") || "",
    technologyAreas: pdf.technologyAreas?.join(", ") || "",
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAndApproving, setIsSavingAndApproving] = useState(false);
  const [isRegeneratingThumbnail, setIsRegeneratingThumbnail] = useState(false);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState(pdf.thumbnailUrl);

  // Update form when pdf changes (different document selected)
  useEffect(() => {
    setForm({
      title: pdf.title || "",
      company: pdf.company || "",
      dateOrYear: pdf.dateOrYear?.toString() || "",
      topic: pdf.topic || "",
      summary: pdf.summary || "",
      continent: pdf.continent || "",
      industry: pdf.industry || "",
      documentType: pdf.documentType || "",
      authors: pdf.authors?.join(", ") || "",
      keyFindings: pdf.keyFindings?.join("\n") || "",
      keywords: pdf.keywords?.join(", ") || "",
      technologyAreas: pdf.technologyAreas?.join(", ") || "",
    });
    setCurrentThumbnailUrl(pdf.thumbnailUrl);
  }, [pdf._id]);

  // Update thumbnail when it changes (e.g., after regeneration)
  useEffect(() => {
    setCurrentThumbnailUrl(pdf.thumbnailUrl);
  }, [pdf.thumbnailUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(pdf._id, form);
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndApprove = async () => {
    if (!onSaveAndApprove) return;
    setIsSavingAndApproving(true);
    try {
      await onSaveAndApprove(pdf._id, form);
      onClose();
    } catch (error) {
      console.error("Failed to save and approve:", error);
      alert("Failed to save and approve. Please try again.");
    } finally {
      setIsSavingAndApproving(false);
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!onRegenerateThumbnail) return;
    setIsRegeneratingThumbnail(true);
    try {
      await onRegenerateThumbnail(pdf);
      // Note: The thumbnail URL will be updated through the pdf prop on next render
    } catch (error) {
      console.error("Failed to regenerate thumbnail:", error);
    } finally {
      setIsRegeneratingThumbnail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-foreground/5 border-b border-foreground/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-foreground/50 hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold">Edit Document</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isSavingAndApproving}
              className="px-5 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            {showApproveButton && onSaveAndApprove && (
              <button
                onClick={handleSaveAndApprove}
                disabled={isSaving || isSavingAndApproving}
                className="px-5 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAndApproving ? "Approving..." : "Save & Approve"}
              </button>
            )}
          </div>
        </div>

        {/* Panel Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">
            {/* Left: Thumbnail */}
            <div className="flex-shrink-0 w-40">
              {currentThumbnailUrl || pdf.thumbnailUrl ? (
                <img
                  src={currentThumbnailUrl || pdf.thumbnailUrl}
                  alt={pdf.title}
                  className="w-40 h-52 object-cover rounded-lg border border-foreground/10 shadow-sm"
                />
              ) : (
                <div className="w-40 h-52 bg-foreground/5 rounded-lg border border-foreground/10 flex items-center justify-center">
                  <svg className="w-12 h-12 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <p className="mt-2 text-xs text-foreground/50 text-center truncate">
                {pdf.filename}
              </p>
              {onRegenerateThumbnail && (
                <button
                  onClick={handleRegenerateThumbnail}
                  disabled={isRegeneratingThumbnail}
                  className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isRegeneratingThumbnail ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right: Form Fields */}
            <div className="flex-1 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Document title"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Company name"
                />
              </div>

              {/* Three columns: Year, Region, Industry */}
              <div className="grid grid-cols-3 gap-3">
                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    value={form.dateOrYear}
                    onChange={(e) => setForm({ ...form, dateOrYear: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="e.g., 2024"
                  />
                </div>

                {/* Region/Continent */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Region
                  </label>
                  <select
                    value={form.continent}
                    onChange={(e) => setForm({ ...form, continent: e.target.value as EditPropertiesForm["continent"] })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                  >
                    {CONTINENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Industry
                  </label>
                  <select
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value as EditPropertiesForm["industry"] })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                  >
                    {INDUSTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Document topic"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Summary
                </label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  placeholder="Brief summary of the document"
                />
              </div>

              {/* Extended Metadata Section */}
              <div className="pt-4 border-t border-foreground/10">
                <h3 className="text-sm font-semibold text-foreground/70 mb-4">Extended Metadata</h3>

                {/* Document Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Document Type
                  </label>
                  <select
                    value={form.documentType}
                    onChange={(e) => setForm({ ...form, documentType: e.target.value as EditPropertiesForm["documentType"] })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Authors */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Authors
                  </label>
                  <input
                    type="text"
                    value={form.authors}
                    onChange={(e) => setForm({ ...form, authors: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="Comma-separated author names"
                  />
                </div>

                {/* Keywords */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Keywords
                  </label>
                  <input
                    type="text"
                    value={form.keywords}
                    onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="Comma-separated keywords"
                  />
                </div>

                {/* Technology Areas */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Technology Areas
                  </label>
                  <input
                    type="text"
                    value={form.technologyAreas}
                    onChange={(e) => setForm({ ...form, technologyAreas: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="e.g., AI, Machine Learning, IoT"
                  />
                </div>

                {/* Key Findings */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Key Findings
                  </label>
                  <textarea
                    value={form.keyFindings}
                    onChange={(e) => setForm({ ...form, keyFindings: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                    placeholder="One key finding per line"
                  />
                  <p className="mt-1 text-xs text-foreground/50">Enter each key finding on a new line</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export type { EditPropertiesForm };

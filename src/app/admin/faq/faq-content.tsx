"use client";

import { useState } from "react";
import Link from "next/link";

interface FaqItem {
  question: string;
  answer: string | React.ReactNode;
}

interface FaqSection {
  title: string;
  icon: React.ReactNode;
  description: string;
  items: FaqItem[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Getting Started",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    description: "Learn the basics of using the admin panel",
    items: [
      {
        question: "What is this admin panel for?",
        answer: "This admin panel helps you manage PDF documents for Techleap. You can upload documents, review and approve them before they appear in search results, monitor processing status, and configure integrations with external services like Google Drive."
      },
      {
        question: "How do I upload a document?",
        answer: (
          <div className="space-y-2">
            <p>There are two ways to upload documents:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to <strong>Documents</strong> and drag & drop PDF files into the upload area</li>
              <li>Click "Select PDFs" to browse and select files from your computer</li>
              <li>You can also paste a URL to a PDF file using the "From URL" option</li>
            </ol>
            <p className="text-sm text-foreground/60 mt-2">Multiple files can be uploaded at once.</p>
          </div>
        )
      },
      {
        question: "What happens after I upload a document?",
        answer: (
          <div className="space-y-2">
            <p>After uploading, the document goes through several processing steps:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li><strong>Upload:</strong> The file is stored securely</li>
              <li><strong>Thumbnail generation:</strong> A preview image is created</li>
              <li><strong>Metadata extraction:</strong> Title, company, summary, and other information are extracted</li>
              <li><strong>Text extraction:</strong> The document text is extracted for search</li>
              <li><strong>Indexing:</strong> The content is indexed for semantic search</li>
            </ol>
            <p className="text-sm text-foreground/60 mt-2">You can monitor progress in the <Link href="/admin/status" className="text-primary hover:underline">Processing</Link> section.</p>
          </div>
        )
      },
      {
        question: "Why do documents need approval?",
        answer: "The approval workflow ensures quality control. Documents must be reviewed and approved before they appear in search results. This prevents incomplete or incorrect documents from being shown to users. Go to the Review Queue to approve documents."
      }
    ]
  },
  {
    title: "Document Management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: "Managing and organizing your documents",
    items: [
      {
        question: "How do I edit document properties?",
        answer: "In the Documents section, find the document you want to edit and click the 'Edit' button. A panel will open where you can modify the title, company, summary, industry, region, and other metadata. Click 'Save Changes' when done."
      },
      {
        question: "What do the status badges mean?",
        answer: (
          <div className="space-y-2">
            <ul className="space-y-2">
              <li><span className="px-2 py-0.5 rounded text-xs font-medium bg-foreground/10">pending</span> - Document is waiting to be processed</li>
              <li><span className="px-2 py-0.5 rounded text-xs font-medium bg-info/10 text-info">processing</span> - Document is currently being processed</li>
              <li><span className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">completed</span> - Processing finished successfully</li>
              <li><span className="px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger">failed</span> - Processing encountered an error</li>
            </ul>
          </div>
        )
      },
      {
        question: "How do I delete a document?",
        answer: "Click the 'Delete' button next to any document. You'll be asked to confirm before the document is permanently removed. Deleted documents cannot be recovered."
      },
      {
        question: "Can I reprocess a failed document?",
        answer: "Yes! If a document failed during processing, you can click the 'Retry' button to attempt processing again. Check the Processing section for details on why it failed."
      },
      {
        question: "How do I export document data?",
        answer: (
          <div className="space-y-2">
            <p>Two export options are available in the Documents section:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Export CSV:</strong> Downloads a spreadsheet with all document metadata</li>
              <li><strong>Export Text Files (ZIP):</strong> Downloads extracted text from all documents as a ZIP file</li>
            </ul>
          </div>
        )
      }
    ]
  },
  {
    title: "Review Queue",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    description: "Approving documents for search",
    items: [
      {
        question: "What is the Review Queue?",
        answer: "The Review Queue shows all documents that need your attention. It's divided into tabs: documents ready for approval, documents still processing, documents that failed, and all unapproved documents."
      },
      {
        question: "What does 'Approve' do?",
        answer: "Approving a document makes it visible in search results. Users will be able to find and access the document through the search interface."
      },
      {
        question: "What does 'Reject' do?",
        answer: "Rejecting a document marks it as rejected but keeps it in the system. It won't appear in search results. You can delete rejected documents if needed."
      },
      {
        question: "Can I approve multiple documents at once?",
        answer: "Yes! When viewing the 'Ready for Review' tab, click the 'Approve All' button to approve all documents at once. You'll be asked to confirm before proceeding."
      }
    ]
  },
  {
    title: "Processing & Status",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    description: "Monitoring document processing",
    items: [
      {
        question: "How do I check processing status?",
        answer: "Go to the Processing section to see all active processing jobs, failed jobs, and reprocessing tasks. You can monitor progress and retry failed jobs from here."
      },
      {
        question: "What is metadata reprocessing?",
        answer: "Metadata reprocessing allows you to re-extract information from documents. This is useful when you want to extract new metadata fields or fix extraction errors. Select a filter and click 'Reprocess' to start."
      },
      {
        question: "Why did my document fail to process?",
        answer: "Documents can fail for various reasons: corrupted PDF files, password-protected documents, unsupported formats, or temporary service issues. Check the error message in the Processing section for details, then try the 'Retry' button."
      }
    ]
  },
  {
    title: "Settings & Configuration",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: "Configuring integrations and processing options",
    items: [
      {
        question: "How do I connect Google Drive?",
        answer: (
          <div className="space-y-2">
            <p>To connect Google Drive:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to Settings &gt; Integrations</li>
              <li>Create OAuth credentials in Google Cloud Console</li>
              <li>Enter your Client ID and Client Secret</li>
              <li>Click "Save Credentials" then "Connect to Google"</li>
              <li>Authorize the application when prompted</li>
              <li>Select a folder to use for uploads</li>
            </ol>
          </div>
        )
      },
      {
        question: "What is the Processing Pipeline toggle?",
        answer: "The Processing Pipeline toggle in Settings &gt; Processing controls whether uploaded documents are automatically processed and indexed. When disabled, documents are stored but won't be searchable. Enable it for normal operation."
      },
      {
        question: "What is Metadata Extraction?",
        answer: "Metadata Extraction uses AI to automatically extract title, company name, summary, industry, and other information from uploaded PDFs. This can be disabled in Settings if you prefer to enter metadata manually."
      },
      {
        question: "What are Embedding Providers?",
        answer: "Embedding providers convert document text into vectors for semantic search. Choose between Voyage AI (recommended) or Unstructured.io based on your setup. This affects how accurately documents are found in searches."
      }
    ]
  },
  {
    title: "Troubleshooting",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: "Common issues and solutions",
    items: [
      {
        question: "Document is stuck in 'processing' status",
        answer: "Wait a few minutes as processing can take time for large documents. If it's stuck for more than 10 minutes, try deleting and re-uploading the document. Check the Processing section for any error messages."
      },
      {
        question: "Thumbnail is not showing",
        answer: "Click 'Edit' on the document and use the 'Regenerate Thumbnail' button. If it still fails, the PDF might be corrupted or password-protected."
      },
      {
        question: "Metadata extraction returned empty fields",
        answer: "Some PDFs have limited extractable text (like scanned documents or image-based PDFs). You can manually edit the document properties by clicking 'Edit' in the Documents section."
      },
      {
        question: "Google Drive connection failed",
        answer: "Verify your Client ID and Secret are correct. Make sure you've added the correct redirect URI in Google Cloud Console. The redirect URI should be displayed in the Settings page."
      },
      {
        question: "Export is not downloading",
        answer: "Check your browser's download settings and popup blocker. Try again with a different browser if the issue persists."
      }
    ]
  }
];

export default function FaqContent() {
  const [expandedSection, setExpandedSection] = useState<string | null>("Getting Started");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    setExpandedSection(expandedSection === title ? null : title);
  };

  const toggleItem = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Help & FAQ</h1>
        <p className="text-foreground/60 mt-1">
          Find answers to common questions about using the admin panel
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/pdfs"
          className="p-4 bg-white rounded-xl border border-foreground/10 hover:border-primary/30 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Upload Documents</div>
              <div className="text-xs text-foreground/50">Add new PDFs</div>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/pending"
          className="p-4 bg-white rounded-xl border border-foreground/10 hover:border-primary/30 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Review Queue</div>
              <div className="text-xs text-foreground/50">Approve documents</div>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/settings"
          className="p-4 bg-white rounded-xl border border-foreground/10 hover:border-primary/30 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Settings</div>
              <div className="text-xs text-foreground/50">Configure integrations</div>
            </div>
          </div>
        </Link>
      </div>

      {/* FAQ Sections */}
      <div className="space-y-4">
        {FAQ_SECTIONS.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl border border-foreground/10 overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-foreground/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {section.icon}
                </div>
                <div className="text-left">
                  <div className="font-semibold">{section.title}</div>
                  <div className="text-sm text-foreground/50">{section.description}</div>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-foreground/40 transition-transform ${
                  expandedSection === section.title ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Section Content */}
            {expandedSection === section.title && (
              <div className="border-t border-foreground/10">
                {section.items.map((item, index) => {
                  const itemKey = `${section.title}-${index}`;
                  const isExpanded = expandedItems.has(itemKey);

                  return (
                    <div
                      key={itemKey}
                      className="border-b border-foreground/5 last:border-b-0"
                    >
                      <button
                        onClick={() => toggleItem(itemKey)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-foreground/5 transition-colors"
                      >
                        <span className="font-medium pr-4">{item.question}</span>
                        <svg
                          className={`w-4 h-4 text-foreground/40 flex-shrink-0 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="px-6 pb-4 text-foreground/70">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Support */}
      <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-foreground/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Still need help?</h3>
            <p className="text-sm text-foreground/60">
              Contact your system administrator or refer to the technical documentation for advanced configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Escape CSV field values
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle arrays - join with semicolons
  if (Array.isArray(value)) {
    value = value.join("; ");
  }

  const stringValue = String(value);

  // If the field contains comma, newline, or double quote, wrap in quotes
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    // Escape double quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export async function GET() {
  try {
    const convex = getConvexClient();

    // Get all PDFs for export
    const pdfs = await convex.query(api.pdfs.getAllForExport, {});

    // Define CSV columns
    const columns = [
      { key: "_id", header: "ID" },
      { key: "title", header: "Title" },
      { key: "filename", header: "Filename" },
      { key: "company", header: "Company" },
      { key: "dateOrYear", header: "Date/Year" },
      { key: "topic", header: "Topic" },
      { key: "summary", header: "Summary" },
      { key: "continent", header: "Region" },
      { key: "industry", header: "Industry" },
      { key: "documentType", header: "Document Type" },
      { key: "authors", header: "Authors" },
      { key: "keywords", header: "Keywords" },
      { key: "technologyAreas", header: "Technology Areas" },
      { key: "keyFindings", header: "Key Findings" },
      { key: "status", header: "Status" },
      { key: "approved", header: "Approved" },
      { key: "source", header: "Source" },
      { key: "pageCount", header: "Page Count" },
      { key: "uploadedAt", header: "Uploaded At" },
      { key: "extractedAt", header: "Extracted At" },
      { key: "extractionVersion", header: "Extraction Version" },
    ];

    // Build CSV header row
    const headerRow = columns.map((col) => col.header).join(",");

    // Build CSV data rows
    const dataRows = pdfs.map((pdf) => {
      return columns
        .map((col) => {
          let value = pdf[col.key as keyof typeof pdf];

          // Format dates
          if ((col.key === "uploadedAt" || col.key === "extractedAt") && typeof value === "number") {
            value = new Date(value).toISOString();
          }

          // Format boolean
          if (col.key === "approved") {
            value = value ? "Yes" : "No";
          }

          return escapeCSVField(value);
        })
        .join(",");
    });

    // Combine header and data rows
    const csvContent = [headerRow, ...dataRows].join("\n");

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `extracted-metadata-${timestamp}.csv`;

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import archiver from "archiver";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Sanitize filename to be safe for file systems
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200); // Limit filename length
}

export async function GET() {
  try {
    const convex = getConvexClient();

    // Get all PDFs with extracted text URLs
    const pdfs = await convex.query(api.pdfs.getAllForExport, {});

    // Filter to only PDFs with extracted text
    const pdfsWithText = pdfs.filter((pdf) => pdf.extractedTextUrl);

    if (pdfsWithText.length === 0) {
      return NextResponse.json(
        { error: "No extracted text files found" },
        { status: 404 }
      );
    }

    // Fetch all text files first
    const textFetchPromises = pdfsWithText.map(async (pdf) => {
      try {
        const response = await fetch(pdf.extractedTextUrl!);
        if (response.ok) {
          const text = await response.text();
          const filename = sanitizeFilename(pdf.title || pdf.filename.replace(".pdf", "")) + ".txt";
          return { filename, text };
        }
        return null;
      } catch (err) {
        console.error(`Failed to fetch text for ${pdf.title}:`, err);
        return null;
      }
    });

    const textFiles = (await Promise.all(textFetchPromises)).filter(Boolean) as { filename: string; text: string }[];

    if (textFiles.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch any text files" },
        { status: 500 }
      );
    }

    // Create archive and collect data into buffer
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const archive = archiver("zip", {
        zlib: { level: 5 },
      });

      archive.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      archive.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on("error", (err) => {
        reject(err);
      });

      // Add all files to the archive
      for (const file of textFiles) {
        archive.append(file.text, { name: file.filename });
      }

      // Finalize the archive
      archive.finalize();
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `extracted-texts-${timestamp}.zip`;

    // Return ZIP as downloadable file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("ZIP export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

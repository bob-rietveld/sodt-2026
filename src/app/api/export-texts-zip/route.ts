import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import archiver from "archiver";
import { PassThrough } from "stream";

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

    // Create a buffer to hold the zip content
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    // Create the archive
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Compression level
    });

    archive.pipe(passThrough);

    // Add each text file to the archive
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

    const textFiles = await Promise.all(textFetchPromises);

    // Add successfully fetched files to the archive
    for (const file of textFiles) {
      if (file) {
        archive.append(file.text, { name: file.filename });
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for the stream to finish
    await new Promise<void>((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

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

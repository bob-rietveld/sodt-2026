import { NextRequest, NextResponse } from "next/server";
import { runWorkflow, runWorkflowFromUrl, triggerWorkflow } from "@/lib/unstructured/workflow";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle multipart form data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const workflowId = formData.get("workflowId") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "File is required" },
          { status: 400 }
        );
      }

      if (!workflowId) {
        return NextResponse.json(
          { error: "Workflow ID is required" },
          { status: 400 }
        );
      }

      const result = await runWorkflow(
        workflowId,
        file,
        file.name,
        file.type || "application/pdf"
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        workflowRunId: result.workflowRunId,
      });
    }

    // Handle JSON body
    const body = await request.json();
    const { workflowId, fileUrl, filename, triggerOnly } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // If triggerOnly is true, just trigger the workflow without uploading a file
    // Use this for workflows with remote source connectors (e.g., Google Drive)
    if (triggerOnly) {
      const result = await triggerWorkflow(workflowId);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        workflowRunId: result.workflowRunId,
      });
    }

    // Otherwise, fetch from URL and upload to workflow
    if (!fileUrl) {
      return NextResponse.json(
        { error: "File URL is required (or set triggerOnly: true)" },
        { status: 400 }
      );
    }

    const result = await runWorkflowFromUrl(
      workflowId,
      fileUrl,
      filename || "document.pdf"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workflowRunId: result.workflowRunId,
    });
  } catch (error) {
    console.error("Workflow run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

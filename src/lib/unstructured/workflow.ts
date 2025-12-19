export interface WorkflowRunResponse {
  workflow_run_id: string;
  status: string;
}

export interface WorkflowRunResult {
  success: boolean;
  workflowRunId?: string;
  error?: string;
}

/**
 * Run an Unstructured workflow with a file
 */
export async function runWorkflow(
  workflowId: string,
  file: File | Blob,
  filename: string,
  mimeType: string = "application/pdf"
): Promise<WorkflowRunResult> {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  const apiKey = process.env.UNSTRUCTURED_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      success: false,
      error: "UNSTRUCTURED_API_URL and UNSTRUCTURED_API_KEY must be set",
    };
  }

  if (!workflowId) {
    return {
      success: false,
      error: "Workflow ID is required",
    };
  }

  try {
    const formData = new FormData();
    formData.append("input_files", file, filename);

    const response = await fetch(`${apiUrl}/workflows/${workflowId}/run`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "unstructured-api-key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Workflow failed: ${response.status} - ${errorText}`,
      };
    }

    const data: WorkflowRunResponse = await response.json();

    return {
      success: true,
      workflowRunId: data.workflow_run_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger an Unstructured workflow without uploading a file
 * Use this for workflows configured with remote source connectors (e.g., Google Drive)
 */
export async function triggerWorkflow(
  workflowId: string
): Promise<WorkflowRunResult> {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  const apiKey = process.env.UNSTRUCTURED_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      success: false,
      error: "UNSTRUCTURED_API_URL and UNSTRUCTURED_API_KEY must be set",
    };
  }

  if (!workflowId) {
    return {
      success: false,
      error: "Workflow ID is required",
    };
  }

  try {
    const response = await fetch(`${apiUrl}/workflows/${workflowId}/run`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "unstructured-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Workflow failed: ${response.status} - ${errorText}`,
      };
    }

    const data: WorkflowRunResponse = await response.json();

    return {
      success: true,
      workflowRunId: data.workflow_run_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run an Unstructured workflow with a file from URL
 */
export async function runWorkflowFromUrl(
  workflowId: string,
  fileUrl: string,
  filename: string
): Promise<WorkflowRunResult> {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  const apiKey = process.env.UNSTRUCTURED_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      success: false,
      error: "UNSTRUCTURED_API_URL and UNSTRUCTURED_API_KEY must be set",
    };
  }

  if (!workflowId) {
    return {
      success: false,
      error: "Workflow ID is required",
    };
  }

  try {
    // Fetch the file from URL
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch file: ${fileResponse.status}`,
      };
    }

    const blob = await fileResponse.blob();
    const mimeType = fileResponse.headers.get("content-type") || "application/pdf";

    return runWorkflow(workflowId, blob, filename, mimeType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check the status of a workflow run
 */
export async function getWorkflowRunStatus(
  workflowId: string,
  runId: string
): Promise<{ status: string; error?: string }> {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  const apiKey = process.env.UNSTRUCTURED_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      status: "error",
      error: "UNSTRUCTURED_API_URL and UNSTRUCTURED_API_KEY must be set",
    };
  }

  try {
    const response = await fetch(
      `${apiUrl}/workflows/${workflowId}/runs/${runId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "unstructured-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      return {
        status: "error",
        error: `Failed to get status: ${response.status}`,
      };
    }

    const data = await response.json();
    return { status: data.status };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

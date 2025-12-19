import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();

// Register workpool component for PDF processing queue
app.use(workpool, { name: "pdfWorkpool" });

export default app;

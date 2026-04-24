// Ensure we are in a serverless context
process.env.NETLIFY = "true";

import serverless from "serverless-http";
import app from "../server";

// functions/server.ts
export const handler = serverless(app);

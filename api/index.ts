import serverless from "serverless-http";
import { app } from "../server/src/app.js";

export const config = {
  runtime: "nodejs20.x" as const,
  maxDuration: 30,
};

export default serverless(app);

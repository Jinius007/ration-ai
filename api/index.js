import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import serverless from "serverless-http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../server/.env") });

import { app } from "../server/src/app.js";

export default serverless(app);

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "./app.js";

const PORT = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Build client first: npm run build --prefix client" });
  });
});

app.listen(PORT, () => {
  console.log(`Pashu Poshan API on http://localhost:${PORT}`);
});

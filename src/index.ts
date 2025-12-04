import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./utils/query";
import authRouter from "./routes/auth";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Auth routes (mounted under /api/auth)
app.use("/api/auth", authRouter);

app.get("/", (_req, res) => {
  try {
    res.send("Backend is running");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

async function testDb() {
  try {
    const rows = await query<{ now: Date }>("SELECT NOW() AS now");
    console.log("✅ DB connection OK. Server time:", rows[0].now);
  } catch (err) {
    console.error("❌ DB connection FAILED:", err);
  }
}

testDb();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

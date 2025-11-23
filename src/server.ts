import express from "express";
import summarizeRouter from "./routes/summarize.route";

const app = express();
app.use(express.json());
app.use("/api", summarizeRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;


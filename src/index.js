import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./database/db.js";
dotenv.config();
const port = process.env.PORT;
const app = express();

// import routes
import users from "./routes/authRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

// middleware
app.use(cors());
app.use(express.json());

// connect to database
connectDB();

// api endpoints
app.use("/api/users", users);

// upload
app.use("/api/upload", uploadRoutes);

app.get("/", async (req, res) => {
  res.send("bookshelf server running rapidly");
});

app.listen(port, () => {
  console.log(`bookshelf server running on port http://localhost:${port}`);
});

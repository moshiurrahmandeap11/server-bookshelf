import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./database/db.js";
dotenv.config();
const port = process.env.PORT || 8080;
const app = express();

// import routes
import users from "./routes/authRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import categories from "./routes/categoryRoutes.js";
import bookRoutes from "./routes/booksRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

app.use(cors({
    origin: 'http://localhost:3000',  
    credentials: true,                
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization']
}));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// connect to database
connectDB();

// api endpoints
app.use("/api/users", users);
app.use("/api/upload", uploadRoutes);
app.use("/api/categories", categories);
app.use("/api/books", bookRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/contact", contactRoutes);



app.get("/", async (req, res) => {
  res.send("bookshelf server running rapidly");
});

app.listen(port, () => {
  console.log(`bookshelf server running on port http://localhost:${port}`);
});
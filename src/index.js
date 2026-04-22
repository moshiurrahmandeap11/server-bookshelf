import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const port = process.env.PORT;
const app = express();


// middleware
app.use(cors());
app.use(express.json());


app.get("/", async(req, res) => {
    res.send("bookshelf server running rapidly")
})

app.listen(port, () => {
    console.log(`bookshelf server running on port http://localhost:${port}`);
})
import { Router } from "express";
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBookById,
  deleteBook,
  addReview,
  deleteReview,
  deleteGalleryImage,
  getUserBooks,
  updateReview
} from "../controllers/booksControllers.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadFields } from "../middleware/upload.js"; // ✅ uploadFields ব্যবহার করুন

const router = Router();

// পাবলিক রাউটস
router.get("/", getAllBooks);
router.get("/:id", getBookById);
router.get("/user/me", verifyToken, getUserBooks);

// ✅ প্রোটেক্টেড রাউটস (uploadFields ব্যবহার)
router.post(
  "/",
  verifyToken,
  uploadFields('books', [
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  createBook
);

router.put(
  "/:id",
  verifyToken,
  uploadFields('books', [
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  updateBookById
);

router.delete("/:id", verifyToken, deleteBook);
router.delete("/:id/images/:imageId", verifyToken, deleteGalleryImage);

// রিভিউ রাউটস
router.post("/:id/reviews", verifyToken, addReview);
router.put("/:id/reviews/:reviewId", verifyToken, updateReview);  
router.delete("/:id/reviews/:reviewId", verifyToken, deleteReview);

export default router;
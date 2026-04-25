import { Router } from "express";
import { getSettings, resetSettings, updateSettings } from "../controllers/settingsController.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadFields } from "../middleware/upload.js";

const router = Router();

// পাবলিক রাউট
router.get("/", getSettings);

// প্রোটেক্টেড রাউটস (শুধু অ্যাডমিন)
router.put(
  "/",
  verifyToken,
  (req, res, next) => {
    // ডিবাগ লগ
    console.log("🔧 Settings update request received");
    console.log("Content-Type:", req.headers['content-type']);
    next();
  },
  uploadFields('settings', [
    { name: 'favicon', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'ogImage', maxCount: 1 }
  ]),
  (req, res, next) => {
    console.log("📁 Files received:", req.files ? Object.keys(req.files) : "No files");
    next();
  },
  updateSettings
);

router.post("/reset", verifyToken, resetSettings);

export default router;
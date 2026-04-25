import { Router } from "express";
import { getSettings, resetSettings, updateSettings } from "../controllers/settingsController.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadFields } from "../middleware/upload.js";

const router = Router();


router.get("/", getSettings);


router.put(
  "/",
  verifyToken,
  (req, res, next) => {
    next();
  },
  uploadFields('settings', [
    { name: 'favicon', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'ogImage', maxCount: 1 }
  ]),
  (req, res, next) => {

    next();
  },
  updateSettings
);

router.post("/reset", verifyToken, resetSettings);

export default router;
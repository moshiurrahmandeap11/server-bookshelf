import { Router } from "express";
import { 
    uploadSingleFile, 
    uploadMultipleFiles, 
    deleteFile 
} from "../controllers/uploadControllers.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadSingle, uploadMultiple } from "../middleware/upload.js";

const router = Router();

// ==============================================
// সিঙ্গেল ফাইল আপলোড রাউট
// ==============================================
// URL: POST /api/upload/single/:folderName
// Body: form-data with key 'file'
router.post(
    "/single/:folder", 
    verifyToken, 
    (req, res, next) => {
        const folder = req.params.folder;
        const upload = uploadSingle(folder, 'file');
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            next();
        });
    }, 
    uploadSingleFile
);

// ==============================================
// মাল্টিপল ফাইল আপলোড রাউট
// ==============================================
// URL: POST /api/upload/multiple/:folderName
// Body: form-data with key 'files' (multiple files)
router.post(
    "/multiple/:folder", 
    verifyToken, 
    (req, res, next) => {
        const folder = req.params.folder;
        const upload = uploadMultiple(folder, 'files', 10);
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            next();
        });
    }, 
    uploadMultipleFiles
);

// ==============================================
// ফাইল ডিলিট রাউট
// ==============================================
// URL: DELETE /api/upload/delete
// Body: { "publicId": "folder/filename", "resourceType": "image" }
router.delete("/delete", verifyToken, deleteFile);

export default router;
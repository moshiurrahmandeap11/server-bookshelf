import { Router } from "express";
import { 
    uploadSingleFile, 
    uploadMultipleFiles, 
    deleteFile 
} from "../controllers/uploadController.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadSingle, uploadMultiple } from "../middleware/upload.js";

const router = Router();

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


router.delete("/delete", verifyToken, deleteFile);

export default router;
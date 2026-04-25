import { Router } from "express";
import { 
    fetchCategories, 
    fetchCategoryById, 
    fetchCategoriesPaginated,
    createCategory, 
    updateCategory, 
    deleteCategory 
} from "../controllers/categoryControllers.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadSingle } from "../middleware/upload.js";


const router = Router();


router.get("/", fetchCategories);  
router.get("/paginated", fetchCategoriesPaginated); 
router.get("/:id", fetchCategoryById);


router.post("/", verifyToken, uploadSingle('categories', 'image'), createCategory);
router.put("/:id", verifyToken, uploadSingle('categories', 'image'), updateCategory); 
router.delete("/:id", verifyToken, deleteCategory); 

export default router;
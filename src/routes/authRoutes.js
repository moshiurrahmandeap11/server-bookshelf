import { Router } from "express";
import { 
  register, 
  login, 
  getUser, 
  editUser, 
  deleteUser, 
  logOut,
  reactivateUser 
} from "../controllers/authControllers.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadSingle } from "../middleware/upload.js";

const router = Router();


router.post("/register", register);
router.post("/login", login);

// protected routes
router.get("/me", verifyToken, getUser); 
router.put("/edit", verifyToken, uploadSingle('users', 'profilePicture'), editUser); 
router.delete("/delete", verifyToken, deleteUser); 
router.post("/logout", verifyToken, logOut); 
router.post("/reactivate", verifyToken, reactivateUser); 

export default router;
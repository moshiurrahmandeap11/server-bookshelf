import { Router } from "express";
import { 
  register, 
  login, 
  getUser, 
  getAllUsers,
  getUserById,
  updateUserById,
  updateUserRole,
  deleteUserById,
  editUser, 
  deleteUser, 
  logOut,
  reactivateUser, 
  googleLogin
} from "../controllers/authControllers.js";
import verifyToken from "../middleware/verifyToken.js";
import { uploadSingle } from "../middleware/upload.js";

const router = Router();


router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);


router.get("/me", verifyToken, getUser); 
router.put("/edit", verifyToken, uploadSingle('users', 'profilePicture'), editUser); 
router.delete("/delete", verifyToken, deleteUser); 
router.post("/logout", verifyToken, logOut); 
router.post("/reactivate", verifyToken, reactivateUser); 


router.get("/users", verifyToken, getAllUsers);         
router.get("/users/:id", verifyToken, getUserById);     
router.put("/users/:id", verifyToken, updateUserById);    
router.put("/users/:id/role", verifyToken, updateUserRole); 
router.delete("/users/:id", verifyToken, deleteUserById); 

export default router;
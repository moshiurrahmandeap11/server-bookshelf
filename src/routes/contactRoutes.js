import { Router } from "express";
import {
  submitContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
  replyToContact,
} from "../controllers/contactController.js";
import verifyToken from "../middleware/verifyToken.js";

const router = Router();


router.post("/", submitContact);


router.get("/", verifyToken, getAllContacts);
router.get("/:id", verifyToken, getContactById);
router.put("/:id/status", verifyToken, updateContactStatus);
router.put("/:id/reply", verifyToken, replyToContact); 
router.delete("/:id", verifyToken, deleteContact);

export default router;
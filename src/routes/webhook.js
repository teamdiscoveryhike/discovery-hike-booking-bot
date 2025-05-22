
import express from "express";
import handleMessage from "../handlers/handleMessage.js";

const router = express.Router();
router.post("/", handleMessage);
export default router;

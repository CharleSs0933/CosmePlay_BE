import express from "express";

import { getAllPosts, getPost } from "../controller/post.controller";

const router = express.Router();

router.get("/", getAllPosts);
router.get("/:category", getPost);

export default router;

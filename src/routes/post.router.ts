import express from "express";

import { getPost } from "../controller/post.controller";

const router = express.Router();

router.get("/:category", getPost);

export default router;

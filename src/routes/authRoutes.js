const express = require("express");
const router = express.Router();
const authController = require("../conteoller/authController");
const auth = require("../middleware/authMiddleware..js");
const { upload } = require("../middleware/multer");

router.post("/login", authController.login);
router.post("/signup", authController.signup);
router.post("/verify-otp", authController.verifyOtp);
router.post(
  "/complete-profile",
  auth,
  upload.single("avatar"),
  authController.completeProfile
);

module.exports = router;

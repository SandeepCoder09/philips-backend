const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/upload");

/* =========================================
   UPLOAD IMAGE
========================================= */

router.post("/image", upload.single("image"), (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image uploaded",
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        res.status(200).json({
            success: true,
            message: "Image uploaded successfully",
            image: imageUrl,
        });

    } catch (error) {

        console.error("Upload Error:", error);

        res.status(500).json({
            success: false,
            message: "Upload failed",
        });
    }
});

module.exports = router;
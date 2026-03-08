const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const upload = multer({
    storage: multer.memoryStorage()
});

const compressImage = async (req, res, next) => {
    try {

        if (!req.file) {
            return next();
        }

        const filename =
            Date.now() + "-" + Math.round(Math.random() * 1e9) + ".webp";

        const outputPath = path.join(
            __dirname,
            "../uploads",
            filename
        );

        await sharp(req.file.buffer)
            .resize({ width: 800 }) // limit width
            .webp({ quality: 70 }) // compress
            .toFile(outputPath);

        req.file.filename = filename;

        next();

    } catch (error) {

        console.error("Image compression error:", error);

        res.status(500).json({
            success: false,
            message: "Image processing failed"
        });
    }
};

module.exports = { upload, compressImage };
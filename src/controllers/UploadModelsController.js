const fs = require("fs");
const { GridFSBucket } = require("mongodb");
const connectDB = require("../config/dbModel");
const moment = require("moment");
const arff = require("arff");
const path = require("path");
const { exec } = require("child_process");

// Upload ARFF file
exports.uploadArff = async (req, res) => {
  try {
    const filePath = req.file.path;
    const filename = req.file.filename;
    const uploadedAt = moment().format("D/M/YYYY HH:mm:ss");

    const db = await connectDB();
    const bucket = new GridFSBucket(db);

    const uploadStream = bucket.openUploadStream(filename);
    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on("finish", async () => {
        fs.unlinkSync(filePath); // Delete local file after upload

        await db
          .collection("fs.files")
          .updateOne({ filename }, { $set: { uploadedAt } });

        res.redirect("/admin/managemodel?message=อัปโหลดสำเร็จ");
      })
      .on("error", (err) => {
        console.error("Error uploading file to GridFS:", err);
        fs.unlinkSync(filePath);
        res.redirect("/admin/managemodel?message=อัปโหลดไม่สำเร็จ");
      });
  } catch (err) {
    console.error("Error:", err);
    res.redirect("/admin/managemodel?message=Error uploading ARFF model.");
  }
};

// Delete ARFF file
exports.deleteArff = async (req, res) => {
  try {
    const filename = req.params.filename;
    const db = await connectDB();
    const bucket = new GridFSBucket(db);
    const filesCollection = db.collection("fs.files");

    const file = await filesCollection.findOne({ filename });
    if (!file) {
      console.error(`File not found in GridFS: ${filename}`);
      return res.status(404).json({ success: false, message: "ไม่พบ" });
    }

    await bucket.delete(file._id);
    await filesCollection.deleteOne({ filename });

    const tempFilePath = path.join(__dirname, "../temp", `${filename}.arff`);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`File deleted from temp folder: ${tempFilePath}`);
    } else {
      console.warn(`File not found in temp folder: ${tempFilePath}`);
    }

    res.status(200).json({ success: true, alertMessage: "ลบสำเร็จ" });
  } catch (err) {
    console.error("Error deleting ARFF file:", err);
    res.status(500).json({ success: false, message: "ลบไม่สำเร็จ" });
  }
};

exports.editArff = async (req, res) => {
  try {
    const oldFilename = req.params.filename;
    const newFilename = req.body.newFilename;

    const db = await connectDB();
    const bucket = new GridFSBucket(db);
    const filesCollection = db.collection("fs.files");

    const file = await filesCollection.findOne({ filename: oldFilename });
    if (!file) {
      return res.status(404).json({ success: false, message: "File not found." });
    }

    const tempFilePath = path.join(__dirname, "../temp", `${oldFilename}.arff`);

    const downloadStream = bucket.openDownloadStream(file._id);
    const writeStream = fs.createWriteStream(tempFilePath);

    downloadStream.pipe(writeStream);

    writeStream.on("finish", async () => {
      const uploadStream = bucket.openUploadStream(newFilename);
      fs.createReadStream(tempFilePath)
        .pipe(uploadStream)
        .on("finish", async () => {
          await bucket.delete(file._id);
          fs.unlinkSync(tempFilePath);
          res.status(200).json({ success: true, alertMessage: "เปลี่ยนชื่อสำเร็จ" });
        })
        .on("error", (err) => {
          console.error("Error uploading new file:", err);
          res.status(500).json({ success: false, message: "ไม่สามารถเปลี่ยนชื่อไฟล์ได้" });
        });
    });

    writeStream.on("error", (err) => {
      console.error("Error during file download:", err);
      res.status(500).json({ success: false, message: "ไม่สามารถดาวน์โหลดไฟล์ได้" });
    });
  } catch (err) {
    console.error("Error editing ARFF file:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์" });
  }
};

// Manage models
exports.managemodel = async (req, res) => {
  try {
    const db = await connectDB();
    const filesCollection = db.collection("fs.files");

    const uploadedArffFiles = await filesCollection.find().toArray();
    const activeModel = await filesCollection.findOne({ currentlyActive: true });

    uploadedArffFiles.forEach((file) => {
      if (typeof file.uploadedAt === "string") {
        file.uploadedAt = moment(file.uploadedAt, "DD/MM/YYYY HH:mm:ss").toISOString();
      }
    });

    res.render("item/admin/managemodel", {
      locals: { title: "จัดการโมเดลพยากรณ์" },
      uploadedFiles: uploadedArffFiles,
      activeModel: activeModel ? activeModel.filename : null,
      message: req.query.message || "",
      moment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Get all models from MongoDB
exports.getModels = async (req, res) => {
  try {
    const db = await connectDB();
    const filesCollection = db.collection("fs.files");

    const models = await filesCollection.find().toArray();
    res.json({ success: true, models });
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ success: false, message: "Error fetching models." });
  }
};

// Train model
exports.trainModel = async (req, res) => {
  const modelFilename = req.body.modelFilename;
  let userData = [
    req.body.gender === "Male" ? 0 : 1,
    req.body.education === "Grade 12" ? 0 : req.body.education === "Vocational" ? 1 : 2,
    ...[req.body.grade1, req.body.grade2, req.body.grade3].map(grade =>
      ({ A: 0, "B+": 1, B: 1, "C+": 2, C: 2, "D+": 3, D: 3, F: 4, I: 4 , W: 4}[grade] || 1)
    )
  ];

  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `${modelFilename}.arff`);

  try {
    const db = await connectDB();
    const bucket = new GridFSBucket(db);
    const file = await db.collection("fs.files").findOne({ filename: modelFilename });

    if (!file) {
      return res.status(404).json({ success: false, message: "Model file not found." });
    }

    const downloadStream = bucket.openDownloadStream(file._id);
    let data = "";

    downloadStream.on("data", (chunk) => {
      data += chunk;
    });

    downloadStream.on("end", () => {
      fs.writeFileSync(tempFilePath, data);

      const command = `python ${path.join(__dirname, "../script.py")} ${tempFilePath} ${userData.join(" ")}`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          return res.status(500).json({ success: false, message: "Model training failed." });
        }

        const outputLines = stdout.trim().split("\n");
        if (outputLines.length < 5) {
          return res.status(500).json({ success: false, message: "Unexpected output from model training." });
        }

        const [accuracy, f1Score, precision, recall, prediction] = outputLines.map(line => line.split(": ")[1]);
        res.status(200).json({ success: true, accuracy, f1Score, precision, recall, prediction });
      });
    });

    downloadStream.on("error", (err) => {
      console.error(`Error downloading file: ${err}`);
      res.status(500).json({ success: false, message: "Error downloading file." });
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, message: "An error occurred while processing the model." });
  }
};

// Toggle ARFF model
exports.toggleModel = async (req, res) => {
  try {
    const filename = req.params.filename;
    const enable = req.body.enable;

    const db = await connectDB();
    const filesCollection = db.collection("fs.files");

    const file = await filesCollection.findOne({ filename });
    if (!file) {
      return res.status(404).json({ success: false, message: "ไม่พบโมเดล" });
    }

    if (enable) {
      await filesCollection.updateMany({ active: true }, { $set: { active: false } });
      await filesCollection.updateOne({ filename }, { $set: { active: true, currentlyActive: true } });

      res.json({ success: true, message: "โมเดลเปิดใช้งานแล้ว" });
    } else {
      await filesCollection.updateOne({ filename }, { $set: { active: false, currentlyActive: false } });
      res.json({ success: true, message: "โมเดลปิดการใช้งานแล้ว" });
    }
  } catch (err) {
    console.error("Error toggling model:", err);
    res.status(500).json({ success: false, message: "ไม่สามารถเปลี่ยนสถานะโมเดลได้" });
  }
};

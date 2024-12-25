const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const connectDB = require("../config/dbUser");
const FileData = require("../models/User");
const moment = require("moment");
async function findStudentInAllCollections(studentId) {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      const modelName = collection.name;

      let StudentModel = mongoose.models[modelName] || 
        mongoose.model(modelName, new mongoose.Schema({}, { strict: false }), modelName);

      const student = await StudentModel.findOne({ studentId });

      if (student) {
        console.log(`Student found in collection: ${modelName}`);
        return student;
      }
    }

    console.log("Student not found in any collection.");
    return null;
  } catch (err) {
    console.error("Error searching collections:", err);
    throw err;
  }
}

exports.managedata = async (req, res) => {
  try {
    const uploadedFiles = await FileData.find(); 
    res.render("item/admin/managedata", {
      locals: { title: "จัดการข้อมูลนักศึกษา" },
      uploadedFiles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.uploadData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const modelName = req.file.originalname.replace(/\.[^/.]+$/, "");

    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        console.log("CSV Headers:", headers);
      })
      .on("data", (data) => {
        const trimmedData = Object.keys(data).reduce((acc, key) => {
          acc[key.trim()] = data[key].trim();
          return acc;
        }, {});
        console.log("Trimmed Data row:", trimmedData);
        console.log("StudentID:", trimmedData["StudentID"]);
        results.push(trimmedData);
      })
      .on("end", async () => {
        try {
          await connectDB();

          // Prepare the data to store in MongoDB
          const validData = results.map((data) => ({
            studentId: data["StudentID"],
            gender: data["Gender"],
            education: data["Education"],
            grade1: data["Grade1"],
            grade2: data["Grade2"],
            grade3: data["Grade3"],
            uploadedAt: new Date(),
          }));

          console.log("Valid data to store:", validData);

          const fileData = new FileData({
            filename: modelName,
            data: validData,
          });

          await fileData.save();
          fs.unlinkSync(filePath);

          res.render("item/admin/managedata", {
            locals: { title: "จัดการข้อมูลนักศึกษา" },
            uploadedFiles: await FileData.find(),
            alertMessage: "อัปโหลดสำเร็จ",
          });

          console.log("Data stored in MongoDB");
        } catch (err) {
          console.error("Error storing data in MongoDB:", err);
          res.status(500).json({ success: false, alertMessage: "Error storing data in MongoDB." });
        }
      });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ success: false, alertMessage: "Server Error" });
  }
};

// Handle data deletion
exports.deleteData = async (req, res) => {
  try {
    const filename = req.params.filename;

    const result = await FileData.deleteOne({ filename });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "File not found in MongoDB." });
    }

    res.json({ success: true, alertMessage: "ลบสำเร็จ" });
  } catch (err) {
    console.error("Error deleting data from MongoDB:", err);
    res.status(500).json({ success: false, message: "Error deleting data from MongoDB." });
  }
};

// Handle data edit
exports.editData = async (req, res) => {
  try {
    const { oldFilename, newFilename } = req.body;

    if (!oldFilename || !newFilename) {
      console.error("Missing oldFilename or newFilename in request body.");
      return res.status(400).json({ success: false, message: "โปรดระบุชื่อไฟล์เก่าและชื่อไฟล์ใหม่" });
    }

    // ตรวจสอบว่า oldFilename กับ newFilename ไม่เหมือนกัน
    if (oldFilename === newFilename) {
      return res.status(400).json({ success: false, message: "ชื่อไฟล์เก่าและใหม่ไม่สามารถเหมือนกันได้" });
    }

    // ดำเนินการอัปเดตชื่อไฟล์ใน MongoDB
    const result = await FileData.findOneAndUpdate(
      { filename: oldFilename },
      { filename: newFilename },
      { new: true }
    );

    if (!result) {
      console.error("File not found in the database.");
      return res.status(404).json({ success: false, message: "ไม่พบไฟล์ในระบบฐานข้อมูล" });
    }

    res.json({ success: true, message: "แก้ไขชื่อไฟล์สำเร็จ", updatedFile: result });
  } catch (err) {
    console.error("Error editing filename in MongoDB:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
};


// Display user data
exports.user = async (req, res) => {
  try {
    let studentId = req.user.emails[0].value.split("@")[0];
    if (studentId.length > 1) {
      studentId = studentId.slice(0, -1) + "-" + studentId.slice(-1);
    }

    const student = await findStudentInAllCollections(studentId);

    res.render("item/user/user", {
      user: {
        displayName: req.user.displayName,
        emails: req.user.emails,
        gender: student ? student.gender || "Not found" : "Not found",
        education: student ? student.education || "Not found" : "Not found",
      },
      student: student || null,
      formattedStudentId: studentId,
      locals: { title: "User", message: student ? "" : "Not found" },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.previewFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const fileData = await FileData.findOne({ filename });

    if (!fileData) {
      return res.status(404).send("File not found");
    }

    res.render("item/admin/preview", { data: fileData.data, locals: { title: "แสดงข้อมูลไฟล์" } });
  } catch (err) {
    console.error("Error previewing file:", err);
    res.status(500).send("Server Error");
  }
};

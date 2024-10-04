const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const connectDB = require("../config/dbUser");
const getCSVDataModel = require("../models/User");

let uploadedFiles = [];

// Load uploaded files from JSON file
const loadUploadedFiles = () => {
  try {
    uploadedFiles = JSON.parse(fs.readFileSync("uploadedFiles.json", "utf8"));
  } catch (err) {
    console.log("Error reading uploadedFiles.json:", err.message);
    uploadedFiles = [];
  }
};

// Save uploaded files to JSON file
const saveUploadedFiles = () => {
  try {
    fs.writeFileSync("uploadedFiles.json", JSON.stringify(uploadedFiles, null, 2));
  } catch (err) {
    console.error("Error saving uploadedFiles:", err);
  }
};

// Initialize uploaded files on startup
loadUploadedFiles();

// Find student in all collections
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

// Handle data management page
exports.managedata = (req, res) => {
  try {
    res.render("item/admin/managedata", {
      locals: { title: "จัดการข้อมูลนักศึกษา" },
      alert: "",
      uploadedFiles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Handle data upload
exports.uploadData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const results = [];
    const modelName = req.file.originalname.replace(/\.[^/.]+$/, ""); // Use file name as collection name

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        console.log("CSV Headers:", headers); // Log headers to verify
      })
      .on("data", (data) => {
        const trimmedData = Object.keys(data).reduce((acc, key) => {
          acc[key.trim()] = data[key].trim();
          return acc;
        }, {});
        console.log("Trimmed Data row:", trimmedData);
        console.log("StudentID:", trimmedData["StudentID"]); // Verify StudentID extraction
        results.push(trimmedData);
      })
      .on("end", async () => {
        try {
          await connectDB();

          const dataModel = getCSVDataModel(modelName);

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

          await dataModel.create(validData);
          fs.unlinkSync(filePath);

          uploadedFiles.push({
            filename: modelName,
            uploadedAt: new Date().toLocaleString(),
          });
          saveUploadedFiles();

          res.render("item/admin/managedata", {
            locals: { title: "จัดการข้อมูลนักศึกษา" },
            uploadedFiles,
            alertMessage: "อัปโหลดสำเร็จ",
          });

          console.log("Data stored in MongoDB");
        } catch (err) {
          console.error("Error storing data in MongoDB:", err);
          res.status(500).send("Error storing data in MongoDB.");
        }
      });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Server Error");
  }
};

// Handle data deletion
exports.deleteData = async (req, res) => {
  try {
    const filename = req.params.filename;
    const dataModel = getCSVDataModel(filename);

    await dataModel.collection.drop();

    uploadedFiles = uploadedFiles.filter((file) => file.filename !== filename);
    saveUploadedFiles();

    res.json({ success: true, alertMessage: "ลบสำเร็จ" });
  } catch (err) {
    console.error("Error deleting data from MongoDB:", err);
    res.status(500).json({ success: false, message: "Error deleting data from MongoDB." });
  }
};

// Handle data edit
exports.editData = async (req, res) => {
  try {
    const oldFilename = req.params.filename;
    const newFilename = req.body.newFilename.trim();

    if (!newFilename) {
      return res.status(400).json({ success: false, message: "New filename is required." });
    }

    await connectDB();

    const oldModelName = oldFilename.replace(/\.[^/.]+$/, "");
    const newModelName = newFilename.replace(/\.[^/.]+$/, "");

    const db = mongoose.connection.db;

    const oldCollectionExists = await db.listCollections({ name: oldModelName }).toArray();
    if (oldCollectionExists.length === 0) {
      return res.status(404).json({ success: false, message: "Old collection not found." });
    }

    const newCollectionExists = await db.listCollections({ name: newModelName }).toArray();
    if (newCollectionExists.length > 0) {
      return res.status(400).json({ success: false, message: "New collection already exists." });
    }

    await db.renameCollection(oldModelName, newModelName);

    const fileIndex = uploadedFiles.findIndex((file) => file.filename === oldFilename);
    if (fileIndex !== -1) {
      uploadedFiles[fileIndex].filename = newFilename;
      saveUploadedFiles();
    } else {
      return res.status(404).json({ success: false, message: "File not found in uploadedFiles." });
    }

    res.json({ success: true, alertMessage: "เปลี่ยนชื่อสำเร็จ" });
  } catch (err) {
    console.error("Error editing data in MongoDB:", err);
    res.status(500).json({ success: false, message: `Error editing data in MongoDB: ${err.message}` });
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

// Preview file data
exports.previewFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const modelName = filename.replace(/\.[^/.]+$/, "");
    const dataModel = getCSVDataModel(modelName);
    const data = await dataModel.find();

    if (!data.length) {
      return res.status(404).send("File not found");
    }

    res.render("item/admin/preview", { data, locals: { title: "แสดงข้อมูลไฟล์" } });
  } catch (err) {
    console.error("Error previewing file:", err);
    res.status(500).send("Server Error");
  }
};

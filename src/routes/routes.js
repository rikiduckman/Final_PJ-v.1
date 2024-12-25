const express = require("express");
const router = express.Router();
const { home, admin, logout } = require("../controllers/PublicController");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const googleauth = require("../middleware/googleAuth");
const upload = require("../config/upload");
const {
  managemodel,
  uploadArff,
  deleteArff,
  editArff,
  getModels,
  trainModel,
  toggleModel,
} = require("../controllers/UploadModelsController");
const {
  deleteData,
  uploadData,
  editData,
  user,
  previewFile,
  managedata,
} = require("../controllers/UploadDataController");
const {
  submitComment,
  comment,
  getComments,
  deleteComment,
} = require("../controllers/UploadComment");
router.use("/auth",googleauth);

router.get("/",home);
router.get("/logout",logout);

router.get("/user",isAuthenticated, user);

router.get("/admin",isAuthenticated, isAdmin, admin);

router.get("/admin/managedata",isAuthenticated, isAdmin, managedata);
router.post(
  "/upload-csv",
  upload.single("file"),
  isAuthenticated, 
  isAdmin,
  uploadData
);
router.delete(
  "/admin/delete-csv/:filename",
  isAuthenticated, 
  isAdmin,
  deleteData
);
router.put("/admin/edit-csv/:filename", isAuthenticated, isAdmin, editData);
router.get("/preview/:filename",previewFile);

router.get("/admin/managemodel", isAuthenticated, isAdmin, managemodel);
router.post(
  "/upload-arff",
  upload.single("arffFile"),
  isAuthenticated, 
  isAdmin,
  uploadArff
);
router.delete(
  "/admin/delete-arff/:filename",
  isAuthenticated,
  isAdmin,
  deleteArff
);
router.put("/admin/edit-arff/:filename", isAuthenticated, isAdmin, editArff);

router.get("/user/getModels", isAuthenticated, getModels);
router.post("/user/trainModel", isAuthenticated, trainModel);

router.get("/admin/comment", isAuthenticated, isAdmin, comment);
router.get("/admin/getComments", isAuthenticated, isAdmin, getComments);
router.delete(
  "/admin/deleteComment/:id",
  isAuthenticated,
  isAdmin,
  deleteComment
);
router.post("/user/submitComment", isAuthenticated, submitComment);

router.post("/admin/toggle-model/:filename", isAuthenticated, toggleModel);

router.use((req, res, next) => {
  res
    .status(404)
    .send(
      '<script>alert("404 Error: The page you are looking for does not exist."); window.history.back();</script>'
    );
});
module.exports = router;

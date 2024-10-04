const express = require('express');
const router = express.Router();
const { home, admin, logout} = require('../controllers/PublicController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const googleauth = require('../middleware/googleAuth');
const upload = require('../config/upload');
const { managemodel, uploadArff, deleteArff, editArff, getModels, trainModel, toggleModel} = require('../controllers/UploadModelsController');
const { deleteData, uploadData, editData, user, previewFile, managedata } = require('../controllers/UploadDataController');
const { submitComment, comment, getComments, deleteComment } = require('../controllers/UploadComment')
// Middleware for Google authentication
router.use('/auth', googleauth);

// Public routes
router.get('/', home);
router.get('/logout',logout);

// User routes
router.get('/user',user);

// Admin routes
router.get('/admin',admin);

// Manage Data routes
router.get('/admin/managedata', managedata);
router.post('/upload-csv', upload.single('file'), uploadData);
router.delete('/admin/delete-csv/:filename', deleteData);
router.put('/admin/edit-csv/:filename', editData);
router.get('/preview/:filename', previewFile);

// Manage model routes
router.get('/admin/managemodel', managemodel);
router.post('/upload-arff', upload.single('arffFile'), uploadArff);
router.delete('/admin/delete-arff/:filename', deleteArff);
router.put('/admin/edit-arff/:filename', editArff);

// User
router.get('/user/getModels', getModels);
router.post('/user/trainModel', trainModel);

// Comment
router.get('/admin/comment', comment);
router.get('/admin/getComments', getComments);
router.delete('/admin/deleteComment/:id', deleteComment);
router.post('/user/submitComment', submitComment);

// Manage model routes
router.post('/admin/toggle-model/:filename', toggleModel);
module.exports = router;

const mongoose = require('mongoose');

const getCSVDataModel = (collectionName) => {
  return mongoose.models[collectionName] || mongoose.model(collectionName, 
    new mongoose.Schema({
      studentId: String,
      gender: String,
      education: String,
      grade1: String,
      grade2: String,
      grade3: String,
      uploadedAt: Date
    }), 
    collectionName);
};

module.exports = getCSVDataModel;

const express = require('express');
const multer = require('multer');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-admin-sdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://sightsafe-eye-detection.firebasestorage.app', // Use your actual Firebase Storage bucket name
});

// Firestore and Storage references
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// Multer configuration for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// POST /eye-disease/predict endpoint
app.post('/eye-disease/predict', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Upload the image to Firebase Storage
    const file = bucket.file(req.file.filename);
    await file.save(fs.readFileSync(req.file.path), {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Delete the local file after upload
    fs.unlinkSync(req.file.path);

    // Here, you would use your model to predict the disease from the image
    // For now, we'll mock a prediction
    const prediction = {
      result: 'Vascular lesion',
      confidenceScore: 99.67641830444336,
      isAboveThreshold: true,
    };

    // Store the prediction results in Firestore
    const predictionRef = db.collection('predictions').doc();
    const predictionData = {
      result: prediction.result,
      confidenceScore: prediction.confidenceScore,
      isAboveThreshold: prediction.isAboveThreshold,
      createdAt: new Date().toISOString(),
      imageUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
    };

    await predictionRef.set(predictionData);

    // Return the prediction response
    res.status(200).json({
      message: 'Model is predicted successfully.',
      data: {
        id: predictionRef.id,
        ...predictionData,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred during prediction.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

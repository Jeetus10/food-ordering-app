const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const serviceAccount = require('./serviceAccountKey.json');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Firebase Admin Initialization
const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Render / Production environment
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Local development
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});;

// --- API Endpoints ---

// Health Check API
app.get('/api/status', (req, res) => {
  res.json({ status: "Backend is running successfully on Render!", timestamp: new Date() });
});

// API: Add Dish (Cloudinary + Firestore)
app.post('/api/admin/add-dish', async (req, res) => {
  try {
    const { name, price, category, imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Image is required" });
    }

    // Upload image to Cloudinary
    const uploadResult = window.cloudinary ? null : await cloudinary.uploader.upload(imageBase64, {
      folder: "food_app_dishes"
    });

    // Save dish metadata to Firestore
    const dishRef = await db.collection('menu').add({
      name,
      price: Number(price),
      category,
      imageUrl: uploadResult ? uploadResult.secure_url : "",
      available: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, dishId: dishRef.id, imageUrl: uploadResult.secure_url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Create Order & Notify Google Compute Engine (GCE)
app.post('/api/orders/create', async (req, res) => {
  try {
    const { userId, items, totalAmount, deliveryAddress } = req.body;

    // Save order in Firestore
    const orderRef = await db.collection('orders').add({
      userId,
      items,
      totalAmount,
      deliveryAddress,
      status: 'Placed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Background call to Google Compute Engine (GCE) Worker for driver assignment
    const gceIp = process.env.GCE_INSTANCE_IP;
    if (gceIp) {
      fetch(`http://${gceIp}:8080/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderRef.id, deliveryAddress })
      }).catch(e => console.log('GCE Background worker notification failed:', e.message));
    }

    res.status(200).json({ success: true, orderId: orderRef.id, message: "Order placed successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Food App Backend server is running on port ${PORT}`);
});
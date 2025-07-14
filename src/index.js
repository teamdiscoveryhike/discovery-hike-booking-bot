// src/index.js
import express from 'express';
import dotenv from 'dotenv';
import webhookRoutes from './api/webhook.js'; // You'll create this file next

dotenv.config(); // Load environment variables from .env

const app = express();
app.use(express.json()); // Parse JSON bodies

// Register the webhook route at /webhook
app.use('/webhook', webhookRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
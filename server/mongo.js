const mongoose = require('mongoose');

async function connectToMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required in environment variables');
  }

  await mongoose.connect(uri);
}

module.exports = {
  connectToMongo
};

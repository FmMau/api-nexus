const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGO_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_SERVER}`;

const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  await client.connect();

  db = client.db('BancoNexus');

  console.log('MongoDB Atlas conectado');
}

function getDB() {
  return db;
}

module.exports = {
  connectDB,
  getDB,
  client,
};
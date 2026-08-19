import { MongoClient } from 'mongodb';

let client = null;
let db = null;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatbot';
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // Uses default database from Atlas connection string (or 'chatbot' as fallback)
    console.log('MongoDB Connected successfully using native driver');
    return db;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    console.error('The server will continue running. Please make sure MongoDB is running or update MONGODB_URI in your .env file.');
    client = null;
    db = null;
  }
};

const getDb = () => db;
const getClient = () => client;

export { connectDB, getDb, getClient };
export default connectDB;

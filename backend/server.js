import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB, { getDb } from './config/db.js';
import auth from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database on startup
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Verify Database Connection state middleware
app.use((req, res, next) => {
  const db = getDb();
  if (!db) {
    return res.status(503).json({
      error: 'MongoDB is disconnected. Please make sure your database server is running and update the MONGODB_URI connection string in backend/.env'
    });
  }
  next();
});

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment variables. Chat API calls will fail.');
}
const genAI = new GoogleGenerativeAI(apiKey || 'DUMMY_KEY');

// ==========================================================================
// Authentication Routes
// ==========================================================================

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please enter all fields (name, email, password).' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const db = getDb();
    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const userExists = await db.collection('users').findOne({ email: emailLower });
    if (userExists) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save the user
    const newUser = {
      name: name.trim(),
      email: emailLower,
      password: hashedPassword,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    // Sign JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: result.insertedId, name: newUser.name, email: newUser.email },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertedId,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter all fields (email, password).' });
    }

    const db = getDb();
    const emailLower = email.toLowerCase().trim();

    // Locate the user
    const user = await db.collection('users').findOne({ email: emailLower });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials. User not found.' });
    }

    // Verify Password match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials. Password incorrect.' });
    }

    // Sign JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================================================
// Chat Session Routes (PROTECTED by 'auth' middleware)
// ==========================================================================

// 3. Get all chat sessions for the logged-in user
app.get('/api/sessions', auth, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const sessions = await db.collection('sessions')
      .find({ userId: userId }, { projection: { messages: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Create a new chat session for the logged-in user
app.post('/api/sessions', auth, async (req, res) => {
  try {
    const db = getDb();
    const { title } = req.body;
    const userId = new ObjectId(req.user.id);

    const newSession = {
      userId,
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date()
    };

    const result = await db.collection('sessions').insertOne(newSession);
    const createdSession = {
      _id: result.insertedId,
      ...newSession
    };
    res.status(201).json(createdSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get full details of a specific session (includes verify ownership)
app.get('/api/sessions/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const session = await db.collection('sessions').findOne({
      _id: new ObjectId(req.params.id),
      userId: userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied.' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a chat session (includes verify ownership)
app.delete('/api/sessions/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const result = await db.collection('sessions').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Session not found or access denied.' });
    }
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Send message and get response from Gemini (protected, tied to user context)
app.post('/api/sessions/:id/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message content is required as a string.' });
    }

    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const sessionId = new ObjectId(req.params.id);

    const session = await db.collection('sessions').findOne({
      _id: sessionId,
      userId: userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied.' });
    }

    // Double check Gemini Key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Gemini API Key is not configured on the server. Please check your backend .env file.'
      });
    }

    // Construct the user message object
    const userMessage = {
      sender: 'user',
      text: message,
      timestamp: new Date()
    };

    // If the session title is the default 'New Chat', update it using the first message
    let updatedTitle = session.title;
    if (session.title === 'New Chat' && session.messages.length === 0) {
      const trimmedMessage = message.trim();
      updatedTitle = trimmedMessage.length > 30 ? trimmedMessage.substring(0, 27) + '...' : trimmedMessage;
    }

    // Map history to Gemini format (role: 'user' | 'model')
    const formattedHistory = session.messages.map(msg => ({
      role: msg.sender,
      parts: [{ text: msg.text }]
    }));

    // Call Gemini API (using the verified gemini-2.5-flash model)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    const modelMessage = {
      sender: 'model',
      text: responseText,
      timestamp: new Date()
    };

    // Save user/model messages and optional title updates
    await db.collection('sessions').updateOne(
      { _id: sessionId, userId: userId },
      {
        $set: { title: updatedTitle },
        $push: { messages: { $each: [userMessage, modelMessage] } }
      }
    );

    // Retrieve the fully updated session to return
    const updatedSession = await db.collection('sessions').findOne({ _id: sessionId, userId: userId });
    res.json(updatedSession);
  } catch (error) {
    console.error('Chat routing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

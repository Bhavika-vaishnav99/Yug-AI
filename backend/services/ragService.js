import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { VectorStore } from '@langchain/core/vectorstores';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const require = createRequire(import.meta.url);
const pdfPkg = require('pdf-parse');

/**
 * In-memory Vector Store implementing LangChain's VectorStore abstract class.
 */
class MemoryVectorStore extends VectorStore {
  _vectorstoreType() {
    return 'memory';
  }

  constructor(embeddings) {
    super(embeddings, {});
    this.memoryVectors = [];
  }

  async addDocuments(documents) {
    const texts = documents.map(doc => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    for (let i = 0; i < documents.length; i++) {
      this.memoryVectors.push({
        content: documents[i].pageContent,
        embedding: vectors[i],
        metadata: documents[i].metadata
      });
    }
  }

  async similaritySearchVectorWithScore(queryVector, k = 4) {
    const results = this.memoryVectors.map(mv => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < queryVector.length; i++) {
        dot += queryVector[i] * mv.embedding[i];
        normA += queryVector[i] * queryVector[i];
        normB += mv.embedding[i] * mv.embedding[i];
      }
      const sim = (normA && normB) ? (dot / (Math.sqrt(normA) * Math.sqrt(normB))) : 0;
      return [
        { pageContent: mv.content, metadata: mv.metadata },
        sim
      ];
    });

    results.sort((a, b) => b[1] - a[1]);
    return results.slice(0, k);
  }

  static async fromDocuments(docs, embeddings) {
    const store = new MemoryVectorStore(embeddings);
    await store.addDocuments(docs);
    return store;
  }
}

let vectorStore = null;
let isIndexed = false;
let indexedDocName = 'None';
let chunkCount = 0;

/**
 * Extract text from PDF buffer across different pdf-parse export structures.
 */
async function extractPDFText(dataBuffer) {
  if (typeof pdfPkg === 'function') {
    const pdfData = await pdfPkg(dataBuffer);
    return pdfData.text;
  } else if (pdfPkg && pdfPkg.PDFParse) {
    const parser = new pdfPkg.PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    return pdfData.text;
  } else {
    throw new Error('Unsupported pdf-parse export structure');
  }
}

/**
 * Initializes RAG using LangChain components.
 * Scans dataDirPath for PDF files, splits text using RecursiveCharacterTextSplitter,
 * generates embeddings via GoogleGenerativeAIEmbeddings, and creates an in-memory vector store.
 */
export async function initRAG(genAIOrKey, dataDirPath) {
  try {
    if (!fs.existsSync(dataDirPath)) {
      console.log('[LangChain RAG] Data directory does not exist. Operating in standard Chatbot mode.');
      return false;
    }

    const pdfFiles = fs.readdirSync(dataDirPath).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.log('[LangChain RAG] No PDF files found in data folder. Operating in standard Chatbot mode.');
      vectorStore = null;
      isIndexed = false;
      indexedDocName = 'None';
      chunkCount = 0;
      return false;
    }

    const pdfName = pdfFiles[0];
    const pdfPath = path.join(dataDirPath, pdfName);
    indexedDocName = pdfName;

    console.log(`[LangChain RAG] Loading and parsing document: ${pdfPath}`);
    const dataBuffer = fs.readFileSync(pdfPath);
    const rawText = await extractPDFText(dataBuffer);

    console.log(`[LangChain RAG] Extracted ${rawText.length} characters from ${pdfPath}`);

    // Create a LangChain Document
    const doc = new Document({
      pageContent: rawText,
      metadata: { source: 'FAQs.pdf' }
    });

    // Use RecursiveCharacterTextSplitter for chunking
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const docs = await textSplitter.splitDocuments([doc]);
    chunkCount = docs.length;
    console.log(`[LangChain RAG] Created ${chunkCount} document chunks with RecursiveCharacterTextSplitter.`);

    // Initialize Embeddings using supported Gemini Embedding model
    const apiKey = process.env.GEMINI_API_KEY || (typeof genAIOrKey === 'string' ? genAIOrKey : null);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey || 'DUMMY_KEY',
      model: 'gemini-embedding-001',
    });

    // Build Memory Vector Store
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    isIndexed = true;
    console.log(`[LangChain RAG] Successfully indexed ${chunkCount} chunks into MemoryVectorStore.`);
    return true;
  } catch (error) {
    console.error('[LangChain RAG] Failed to initialize RAG:', error);
    return false;
  }
}

/**
 * Searches the indexed document for relevant context given a user query using LangChain VectorStore.
 */
export async function searchRAGContext(genAIOrKey, query, topK = 3) {
  if (!isIndexed || !vectorStore) {
    return { contextText: '', matches: [] };
  }

  try {
    // Perform similarity search
    const results = await vectorStore.similaritySearchWithScore(query, topK);

    const matches = results.map(([doc, score]) => ({
      text: doc.pageContent,
      score: score
    }));

    if (matches.length === 0) {
      return { contextText: '', matches: [] };
    }

    const contextText = matches.map(m => m.text).join('\n---\n');
    return {
      contextText,
      matches
    };
  } catch (error) {
    console.error('[LangChain RAG] Error searching context:', error.message);
    return { contextText: '', matches: [] };
  }
}

/**
 * Gets RAG Service Status information.
 */
export function getRAGStatus() {
  return {
    isIndexed,
    documentName: indexedDocName,
    chunkCount: chunkCount
  };
}

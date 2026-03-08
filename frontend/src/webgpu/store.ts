import { readWorkspaceFile, writeWorkspaceFile } from '../workspace/opfs-manager';
import { embedText, cosineSimilarity } from './embed';

export interface VectorDocument {
  id: string;
  source: string;        // e.g., URL or filename
  content: string;       // raw text chunk (e.g. 500 chars)
  embedding: number[];   // 384-dimensional vector from all-MiniLM-L6-v2
  timestamp: number;
}

export interface SearchResult {
  doc: VectorDocument;
  score: number;
}

const STORE_FILENAME = 'VECTORS.json';

// In-memory cache of the vector store to speed up searches
let vectorCache: VectorDocument[] | null = null;

async function loadStore(): Promise<VectorDocument[]> {
  if (vectorCache) return vectorCache;
  const raw = await readWorkspaceFile(STORE_FILENAME);
  if (!raw) {
    vectorCache = [];
    return vectorCache;
  }
  try {
    vectorCache = JSON.parse(raw) as VectorDocument[];
  } catch {
    vectorCache = [];
  }
  return vectorCache;
}

async function saveStore(docs: VectorDocument[]): Promise<void> {
  vectorCache = docs;
  await writeWorkspaceFile(STORE_FILENAME, JSON.stringify(docs));
}

/**
 * Ingest text into the vector store.
 * Chunks it by paragraph, embeds each chunk, and saves to OPFS.
 */
export async function injectToVectorStore(source: string, fullText: string): Promise<number> {
  const store = await loadStore();
  
  // Simple paragraph chunker
  const chunks = fullText
    .split(/\n\s*\n/)
    .map(c => c.trim())
    .filter(c => c.length > 20); // ignore tiny fragments
    
  let addedCount = 0;
  
  for (const chunk of chunks) {
    // Generate the 384-dim semantic embedding
    const embedding = await embedText(chunk);
    
    store.push({
      id: `vec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source,
      content: chunk,
      embedding,
      timestamp: Date.now()
    });
    addedCount++;
  }
  
  await saveStore(store);
  return addedCount;
}

/**
 * Semantic vector search.
 * Returns the top K most similar text chunks based on cosine distance.
 */
export async function searchVectorStore(query: string, topK: number = 3): Promise<SearchResult[]> {
  const store = await loadStore();
  if (store.length === 0) return [];
  
  const queryEmbedding = await embedText(query);
  
  const results: SearchResult[] = store.map(doc => ({
    doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding)
  }));
  
  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, topK);
}

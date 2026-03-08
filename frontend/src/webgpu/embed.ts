import { pipeline, env } from '@xenova/transformers';

// Try to use WebGPU if available, fallback to WebAssembly (CPU)
env.allowLocalModels = false;
env.useBrowserCache = true;

// Define a type for our pipeline function
type PipelineFn = (text: string, options?: any) => Promise<any>;
let embedPipeline: PipelineFn | null = null;
let isInitializing = false;

export async function initEmbeddingModel(): Promise<void> {
  if (embedPipeline || isInitializing) return;
  isInitializing = true;
  
  try {
    // We try to configure webgpu, but transformers.js will automatically
    // fallback to webassembly if the browser doesn't support WebGPU yet.
    // 'feature-extraction' is the task for generating embeddings
    console.log('[WebGPU] Initializing embedding model (Xenova/all-MiniLM-L6-v2)...');
    
    // @ts-ignore - The types in an older transformers.js version might not strict match 
    // the generic returned by pipeline, but it functions.
    embedPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device: navigator.gpu ? 'webgpu' : 'wasm'
    });
    
    console.log('[WebGPU] Embedding model ready!');
  } catch (error) {
    console.error('[WebGPU] Failed to init embedding model:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate a 384-dimensional float32 vector embedding for a piece of text.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!embedPipeline) {
    await initEmbeddingModel();
  }
  
  if (!embedPipeline) throw new Error('Embedding model failed to initialize');

  // Generate embeddings
  const output = await embedPipeline(text, { pooling: 'mean', normalize: true });
  
  // output.data is a Float32Array
  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two vectors.
 * Assumes vectors are already normalized (magnitude = 1), which transformers.js does mapped with normalize: true.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) throw new Error('Vector dimension mismatch');
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

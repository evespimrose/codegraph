/**
 * Local MiniLM embeddings via @xenova/transformers (Transformers.js).
 *
 * all-MiniLM-L6-v2 → 384-dim, mean-pooled + L2-normalized. Offline after the
 * first model fetch. The dependency is OPTIONAL and loaded lazily, so importing
 * this module is cheap and safe even when transformers isn't installed — the
 * cost (and the requirement) only materialize on the first embed() call.
 */
import { EMBED_DIM } from './config';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
// Module specifier held in a variable so tsc does not statically resolve the
// optional (often-uninstalled) dependency at build time.
const TRANSFORMERS = '@xenova/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _extractor: any = null;

/** Lazy singleton. First call loads the model; subsequent runs are offline. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEmbedder(): Promise<any> {
  if (_extractor) return _extractor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  try {
    mod = await import(TRANSFORMERS);
  } catch {
    throw new Error(
      'The Markdown docs feature needs the optional "@xenova/transformers" ' +
      'dependency, which is not installed. Run: npm i @xenova/transformers'
    );
  }
  const { pipeline, env } = mod;
  // Prefer the local model cache; remote is only hit once to populate it.
  env.allowLocalModels = true;
  _extractor = await pipeline('feature-extraction', MODEL);
  return _extractor;
}

/** Embed a single string → Float32Array(EMBED_DIM). */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const output = await extractor(text ?? '', { pooling: 'mean', normalize: true });
  const vec = Float32Array.from(output.data as Iterable<number>);
  if (vec.length !== EMBED_DIM) {
    throw new Error(`embedding dim ${vec.length} != expected ${EMBED_DIM}`);
  }
  return vec;
}

/** Embed many strings sequentially (Transformers.js batches internally per call). */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}

/** Whether @xenova/transformers can be resolved — the docs feature's hard gate. */
export async function isEmbedAvailable(): Promise<boolean> {
  try {
    await import(TRANSFORMERS);
    return true;
  } catch {
    return false;
  }
}

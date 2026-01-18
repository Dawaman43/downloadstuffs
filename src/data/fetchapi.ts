import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

type TokenWeights = Partial<Record<string, number>>
type Vector = Partial<Record<string, number>>

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

function normalizeUserQuery(input: string): string {
  const q = normalizeForMatch(input)
  // Cheap typo-fixes for very common queries (kept intentionally small).
  return q
    .replace(/\bimposible\b/g, 'impossible')
    .replace(/\bimpossibile\b/g, 'impossible')
    .replace(/\bmisison\b/g, 'mission')
}

function numberToWord(n: number): string | null {
  const map: Record<number, string> = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
    13: 'thirteen',
    14: 'fourteen',
    15: 'fifteen',
    16: 'sixteen',
    17: 'seventeen',
    18: 'eighteen',
    19: 'nineteen',
    20: 'twenty',
  }
  return map[n] ?? null
}

function toRoman(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0 || n >= 40) return null
  const table: Array<[number, string]> = [
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ]
  let remaining = Math.floor(n)
  let out = ''
  for (const [value, sym] of table) {
    while (remaining >= value) {
      out += sym
      remaining -= value
    }
  }
  return out
}

function extractSequelNumber(tokens: Array<string>): number | null {
  for (const t of tokens) {
    if (/^\d{1,2}$/.test(t)) {
      const n = Number.parseInt(t, 10)
      if (Number.isFinite(n) && n >= 1 && n <= 40) return n
    }
  }
  return null
}

function sequelVariants(n: number): Array<string> {
  const variants = new Set<string>()
  variants.add(String(n))
  const roman = toRoman(n)
  if (roman) variants.add(roman)
  const word = numberToWord(n)
  if (word) variants.add(word)
  return Array.from(variants)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= b.length; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

function tokenize(text: string): Array<string> {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function jaccardSimilarity(aTokens: Array<string>, bTokens: Array<string>): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  let intersection = 0
  for (const t of a) {
    if (b.has(t)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function buildDocTokens(doc: Record<string, unknown>): TokenWeights {
  const parts: Array<{ text: string; weight: number }> = [
    { text: String(doc.title ?? ''), weight: 3 },
    {
      text: Array.isArray(doc.subject) ? doc.subject.join(' ') : String(doc.subject ?? ''),
      weight: 2,
    },
    { text: String(doc.description ?? ''), weight: 1.5 },
    {
      text: Array.isArray(doc.creator) ? doc.creator.join(' ') : String(doc.creator ?? ''),
      weight: 1.5,
    },
    { text: String(doc.collection ?? ''), weight: 1 },
  ]

  const tokens: TokenWeights = {}
  for (const { text, weight } of parts) {
    if (!text) continue
    for (const token of tokenize(text)) {
      tokens[token] = (tokens[token] ?? 0) + weight
    }
  }
  return tokens
}

function buildQueryTokens(query: string): TokenWeights {
  const tokens: TokenWeights = {}
  for (const token of tokenize(query)) {
    tokens[token] = (tokens[token] ?? 0) + 3
  }
  return tokens
}

function computeIdf(docs: Array<TokenWeights>): Vector {
  const df: Record<string, number> = {}
  for (const doc of docs) {
    for (const token of Object.keys(doc)) {
      df[token] = (df[token] ?? 0) + 1
    }
  }

  const n = docs.length || 1
  const idf: Vector = {}
  for (const [token, freq] of Object.entries(df)) {
    idf[token] = Math.log(1 + (n + 1) / (freq + 1))
  }
  return idf
}

function toVector(tokens: TokenWeights, idf: Vector): Vector {
  const vec: Vector = {}
  for (const [token, tf] of Object.entries(tokens)) {
    if (typeof tf !== 'number') continue
    vec[token] = tf * (idf[token] ?? 0)
  }
  return vec
}

function vectorNorm(vec: Vector): number {
  let sum = 0
  for (const value of Object.values(vec)) {
    if (typeof value === 'number') sum += value * value
  }
  return Math.sqrt(sum)
}

function cosineSimilarity(queryVec: Vector, docVec: Vector, queryNorm: number): number {
  const docNorm = vectorNorm(docVec)
  if (queryNorm === 0 || docNorm === 0) return 0

  let dot = 0
  const docKeys = Object.keys(docVec)
  const queryKeys = Object.keys(queryVec)
  const smaller = docKeys.length < queryKeys.length ? docKeys : queryKeys

  for (const key of smaller) {
    const q = queryVec[key]
    const d = docVec[key]
    if (q !== undefined && d !== undefined) {
      dot += q * d
    }
  }

  return dot / (queryNorm * docNorm)
}

const searchInput = z.object({
  query: z.string(),
  // Optional: a clean user query used only for reranking. If omitted, `query` is used.
  rerankQuery: z.string().optional(),
  page: z.number().optional(),
  rows: z.number().optional(),
  rerank: z.boolean().optional(),
});

const itemInput = z.object({
  id: z.string()
});

export const searchIA = createServerFn({ method: "GET" })
  .inputValidator(searchInput)
  .handler(async ({ data }) => {
    const { query, rerankQuery, page = 1, rows = 10, rerank = true } = data;
    const start = (page - 1) * rows;
    const fetchRows = rerank ? Math.min(100, Math.max(rows, rows * 5)) : rows

    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      query
    )}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=mediatype&fl[]=date&fl[]=year&fl[]=description&fl[]=downloads&fl[]=subject&fl[]=collection&rows=${fetchRows}&start=${start}&output=json`;

    const res = await fetch(url);
    if (!res.ok) return { docs: [], total: 0 };
    const result = await res.json().catch(() => null);
    const docs = result?.response?.docs ?? [];
    const total =
      typeof result?.response?.numFound === 'number'
        ? result.response.numFound
        : docs.length;

    if (!rerank || !Array.isArray(docs) || docs.length === 0) {
      return { docs, total };
    }

    // Use a clean user query for reranking; Lucene query strings pollute tokenization badly.
    const cleanQuery = normalizeUserQuery((rerankQuery ?? query).trim())

    // Lightweight vector ranking to prefer documents whose metadata better matches the query
    const docTokens = docs.map((doc: Record<string, unknown>) => buildDocTokens(doc));
    const idf = computeIdf(docTokens);
    const queryVec = toVector(buildQueryTokens(cleanQuery), idf);
    const queryNorm = vectorNorm(queryVec);

    const qNormalized = normalizeForMatch(cleanQuery)
    const qTokensAll = tokenize(cleanQuery)
    const qTokens = qTokensAll.filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    const sequel = extractSequelNumber(qTokensAll)
    const sequelSet = sequel ? new Set(sequelVariants(sequel)) : null

    const scored = docs.map((doc: Record<string, unknown>, idx: number) => {
      const docVec = toVector(docTokens[idx], idf);
      const vectorScore = cosineSimilarity(queryVec, docVec, queryNorm);

      const title = typeof doc.title === 'string' ? doc.title : String(doc.title ?? '')
      const titleNorm = normalizeForMatch(title)
      const titleTokens = tokenize(title)
      // Strong preference for phrase-in-title matches.
      const phraseBonus = qNormalized && titleNorm.includes(qNormalized) ? 1.25 : 0

      // Token overlap is a good baseline.
      const tokenOverlap = jaccardSimilarity(qTokens, titleTokens) * 0.9

      // Fuzzy token matching helps with typos like "imposible".
      let fuzzy = 0
      let matchedCount = 0
      for (const qt of qTokens) {
        let best = 99
        for (const tt of titleTokens) {
          // Cheap pruning
          if (Math.abs(qt.length - tt.length) > 2) continue
          best = Math.min(best, levenshtein(qt, tt))
          if (best === 0) break
        }
        const allowed = qt.length >= 8 ? 2 : 1
        if (best <= allowed) {
          matchedCount += 1
          fuzzy += best === 0 ? 0.35 : 0.2
        }
      }

      // If user typed a sequel number, boost titles that include the number/roman/word variant.
      const sequelBonus =
        sequelSet && titleTokens.some((t) => sequelSet.has(t)) ? 0.8 : 0

      // Light penalty for results that barely match the title.
      const coveragePenalty = qTokens.length >= 3 && matchedCount <= 1 ? -0.5 : 0

      const score = vectorScore + phraseBonus + tokenOverlap + fuzzy + sequelBonus + coveragePenalty
      return { doc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return { docs: scored.slice(0, rows).map((item) => item.doc), total };
  });

export const getArchiveItem = createServerFn({ method: "GET" })
  .inputValidator(itemInput)
  .handler(async ({ data }) => {
    const { id } = data;
    const url = `https://archive.org/metadata/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  });

import OpenAI from 'openai'

function getClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) throw new Error('No OpenAI API key available. Add your key in Account Settings.')
  return new OpenAI({ apiKey: key })
}

export interface ScoreBreakdown {
  inbreeding_coefficient: number
  pedigree_outcrossing: number
  discipline_fit: number
  conformation_complement: number
  performance_potential: number
}

export interface RiskFlag {
  flag_type: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface PairingAnalysis {
  compatibility_score: number
  score_breakdown: ScoreBreakdown
  reasoning: string
  risk_flags: RiskFlag[]
  top_strengths: string[]
  considerations: string[]
}

const SYSTEM_PROMPT = (discipline: string) => `You are an expert equine breeding consultant specializing in ${discipline}.
You evaluate stallion-mare compatibility across pedigree, conformation, and performance dimensions.
Always respond with a valid JSON object and nothing else — no preamble, no markdown fences.
Be specific in reasoning. Cite actual ancestors, conformation traits, or offspring records when available.
Flag genuine risks. Do not inflate scores to be encouraging.
If pedigree data is incomplete (< 3 generations), note this limitation and reduce the weight of pedigree-dependent dimensions accordingly. Do not fabricate missing ancestors.`

export async function analyzePairing(
  mare: object,
  stallion: object,
  goal: string,
  discipline: string,
  apiKey?: string,
): Promise<PairingAnalysis> {
  const userMessage = `Evaluate this mating pairing:

MARE:
${JSON.stringify(mare, null, 2)}

STALLION:
${JSON.stringify(stallion, null, 2)}

BREEDER GOAL:
${goal}

Return a JSON object with exactly these fields:
- compatibility_score: number 0.0–1.0
- score_breakdown: object with keys inbreeding_coefficient, pedigree_outcrossing, discipline_fit, conformation_complement, performance_potential (each 0.0–1.0)
- reasoning: string, 2–4 paragraphs plain English, specific citations of ancestors/offspring/conformation traits
- risk_flags: array of { flag_type, description, severity: "low"|"medium"|"high" }
- top_strengths: array of 3 strings
- considerations: array of 2–3 strings`

  const response = await getClient(apiKey).chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(discipline) },
      { role: 'user', content: userMessage },
    ],
  })

  const text = response.choices[0].message.content ?? '{}'
  return JSON.parse(text) as PairingAnalysis
}

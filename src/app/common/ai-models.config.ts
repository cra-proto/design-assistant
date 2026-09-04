export type AiFreeModelOptions = (typeof AI_FREE_MODELS)[number];
export type AiPaidModelOptions = (typeof AI_PAID_MODELS)[number]['value'];

export type PriceTier = '$' | '$$' | '$$$';

export const AI_FREE_MODELS = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'openai/gpt-oss-20b:free', 'nvidia/nemotron-3-super-120b-a12b:free'] as const;

export const AI_PAID_MODELS = [
  { value: 'openai/gpt-oss-20b', price: '$' },
  { value: 'deepseek/deepseek-v4-flash', price: '$' },
  { value: 'deepseek/deepseek-v4-pro', price: '$$' },
  { value: 'google/gemini-3.1-flash-lite', price: '$$' },
  { value: 'openai/gpt-5.4-mini', price: '$$$' },
] as const satisfies { value: string; price: PriceTier }[];

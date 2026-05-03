import client from './client'

export const getOpenAIKey = () =>
  client.get<{ hasKey: boolean; maskedKey: string | null; plan: string; subscriptionStatus: string | null }>('/api/settings/openai-key').then(r => r.data)

export const saveOpenAIKey = (apiKey: string) =>
  client.post<{ success: boolean; maskedKey: string }>('/api/settings/openai-key', { apiKey }).then(r => r.data)

export const deleteOpenAIKey = () =>
  client.delete('/api/settings/openai-key').then(r => r.data)

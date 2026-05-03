import client from './client'

export const getPlans = () =>
  client.get<{ plans: Array<{ id: string; name: string; price: number; description: string }> }>('/api/billing/plans').then(r => r.data)

export const createCheckout = (plan: string) =>
  client.post<{ url: string }>(`/api/billing/checkout/${plan}`).then(r => r.data)

export const createPortal = () =>
  client.post<{ url: string }>('/api/billing/portal').then(r => r.data)

export const createPublicCheckout = (plan: string, email: string) =>
  client.post<{ url: string }>(`/api/billing/checkout/${plan}`, { email }).then(r => r.data)

import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// Inject Clerk token on every request
client.interceptors.request.use(async (config) => {
  // @ts-ignore — window.__clerk is set by ClerkProvider
  const token = await window.Clerk?.session?.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default client

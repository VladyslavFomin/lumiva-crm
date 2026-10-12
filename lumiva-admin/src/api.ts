import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(r => r.data)

// Dashboard
export const getDashboard = () => api.get('/dashboard/stats').then(r => r.data)

// Blog
export const getBlogPosts = (params?: Record<string, any>) =>
  api.get('/blog', { params }).then(r => r.data)
export const getBlogPost = (slug: string) =>
  api.get(`/blog/${slug}`, { params: { admin: '1' } }).then(r => r.data)
export const createBlogPost = (data: any) => api.post('/blog', data).then(r => r.data)
export const updateBlogPost = (id: number, data: any) =>
  api.patch(`/blog/${id}`, data).then(r => r.data)
export const deleteBlogPost = (id: number) => api.delete(`/blog/${id}`).then(r => r.data)
export const translateBlogContent = (data: {
  title: string; excerpt: string; seoTitle: string; seoDescription: string; blocks: any[]
  targetLangs: string[]
  existing?: Record<string, { title?: string; excerpt?: string; seoTitle?: string; seoDescription?: string; blocks?: any[] }>
}) => api.post('/blog/translate', data).then(r => r.data)

// Cases
export const getCases = (params?: Record<string, any>) =>
  api.get('/cases', { params }).then(r => r.data)
export const getCase = (slug: string) => api.get(`/cases/${slug}`).then(r => r.data)
export const getCaseById = (id: number) => api.get(`/cases/by-id/${id}`).then(r => r.data)
export const createCase = (data: any) => api.post('/cases', data).then(r => r.data)
export const updateCase = (id: number, data: any) =>
  api.patch(`/cases/${id}`, data).then(r => r.data)
export const deleteCase = (id: number) => api.delete(`/cases/${id}`).then(r => r.data)
export const translateCaseContent = (data: { targetLangs: string[]; existing?: Record<string, any>; [key: string]: any }) =>
  api.post('/cases/translate', data).then(r => r.data)

// Forms
export const getForms = (params?: Record<string, any>) =>
  api.get('/forms', { params }).then(r => r.data)
export const getFormStats = () => api.get('/forms/stats').then(r => r.data)
export const updateForm = (id: number, data: any) =>
  api.patch(`/forms/${id}`, data).then(r => r.data)
export const deleteForm = (id: number) => api.delete(`/forms/${id}`).then(r => r.data)

// Media
export const getMedia = () => api.get('/media').then(r => r.data)
export const uploadMedia = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/media/upload', fd).then(r => r.data)
}
export const deleteMedia = (filename: string) =>
  api.delete(`/media/${filename}`).then(r => r.data)

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data)
export const setSetting = (key: string, value: string, label?: string, group?: string) =>
  api.put(`/settings/${key}`, { value, label, group }).then(r => r.data)

// CRM
export const getCrmStatus = () => api.get('/crm/status').then(r => r.data)
export const pushLeadToCrm = (id: number) =>
  api.post(`/crm/push-lead/${id}`).then(r => r.data)

// Newsletter
export const getNewsletterSubscribers = (params?: Record<string, any>) =>
  api.get('/newsletter/subscribers', { params }).then(r => r.data)
export const getNewsletterStats = () => api.get('/newsletter/stats').then(r => r.data)
export const unsubscribeEmail = (email: string) =>
  api.post('/newsletter/unsubscribe', { email }).then(r => r.data)
export const exportNewsletterCsv = (lang?: string) => {
  const a = document.createElement('a')
  return api.get(`/newsletter/export${lang ? `?lang=${lang}` : ''}`, { responseType: 'blob' })
    .then(r => {
      const blobUrl = URL.createObjectURL(r.data)
      a.href = blobUrl
      a.download = `subscribers${lang ? '_' + lang : ''}.csv`
      a.click()
      URL.revokeObjectURL(blobUrl)
    })
}

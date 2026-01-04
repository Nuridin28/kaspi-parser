import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface Product {
  id: number
  kaspi_id: string
  name: string | null
  category: string | null
  offers: Offer[]
  created_at: string
  updated_at: string | null
  last_parsed_at: string | null
}

export interface Offer {
  id: number
  price: number
  position: number | null
  in_stock: boolean
  seller_name: string
  seller_rating: number | null
  seller_reviews_count: number
  parsed_at: string
}

export interface Job {
  id: number
  kaspi_url: string
  kaspi_product_id: string | null
  status: 'pending' | 'parsing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface PositionEstimate {
  user_price: number
  estimated_position: number
  total_sellers: number
  percentile: number
}

export const productsApi = {
  create: async (url: string): Promise<Job> => {
    const response = await api.post('/products/', { url })
    return response.data
  },
  
  createBulk: async (urls: string[]): Promise<Job[]> => {
    const response = await api.post('/products/bulk', { urls })
    return response.data
  },
  
  list: async (skip = 0, limit = 100): Promise<Product[]> => {
    const response = await api.get('/products/', { params: { skip, limit } })
    return response.data
  },
  
  get: async (id: number): Promise<Product> => {
    const response = await api.get(`/products/${id}`)
    return response.data
  },
  
  getByKaspiId: async (kaspiId: string): Promise<Product> => {
    const response = await api.get(`/products/kaspi/${kaspiId}`)
    return response.data
  },
  
  update: async (id: number, data: { name?: string; category?: string }): Promise<Product> => {
    const response = await api.put(`/products/${id}`, data)
    return response.data
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/products/${id}`)
  },
  
  parse: async (id: number): Promise<Job> => {
    const response = await api.post(`/products/${id}/parse`)
    return response.data
  },
}

export const analyticsApi = {
  estimatePosition: async (productId: number, userPrice: number): Promise<PositionEstimate> => {
    const response = await api.post(`/analytics/products/${productId}/position?user_price=${userPrice}`)
    return response.data
  },
  
  getStatistics: async (productId: number) => {
    const response = await api.get(`/analytics/products/${productId}/statistics`)
    return response.data
  },
  
  getAnalytics: async (productId: number, date?: string) => {
    const response = await api.get(`/analytics/products/${productId}/analytics`, {
      params: { target_date: date },
    })
    return response.data
  },
  
  getPriceHistory: async (productId: number, startDate: string, endDate: string) => {
    const response = await api.get(`/analytics/products/${productId}/price-history`, {
      params: { start_date: startDate, end_date: endDate },
    })
    return response.data
  },
  
  comparePrices: async (productId: number, date1: string, date2: string) => {
    const response = await api.get(`/analytics/products/${productId}/price-comparison`, {
      params: { date1, date2 },
    })
    return response.data
  },
  
  getAdvancedAnalytics: async (productId: number, userPrice?: number) => {
    const params: any = {}
    if (userPrice) params.user_price = userPrice
    const response = await api.get(`/analytics/products/${productId}/advanced`, { params })
    return response.data
  },
  
  analyzeScenario: async (productId: number, scenarioPrice: number, currentPrice: number) => {
    const response = await api.post(`/analytics/products/${productId}/scenario`, null, {
      params: { scenario_price: scenarioPrice, current_price: currentPrice },
    })
    return response.data
  },
  
  getDashboardMetrics: async () => {
    const response = await api.get('/analytics/dashboard')
    return response.data
  },
}

export interface ReportResponse {
  url: string
  filename: string
}

export interface ReportFile {
  name: string
  size: number
  last_modified: string | null
  etag: string
  url: string
  filename: string
}

export interface ReportListResponse {
  files: ReportFile[]
  total: number
}

export const reportsApi = {
  generateProductExcel: async (productId: number): Promise<ReportResponse> => {
    const response = await api.get(`/reports/products/${productId}/excel`, {
      params: { return_json: true },
    })
    return response.data
  },
  
  generateComparisonExcel: async (productId1: number, productId2: number): Promise<ReportResponse> => {
    const response = await api.get(`/reports/products/compare/excel`, {
      params: { 
        product_id_1: productId1, 
        product_id_2: productId2,
        return_json: true,
      },
    })
    return response.data
  },
  
  generateAdvancedAnalyticsExcel: async (productId: number, userPrice?: number): Promise<ReportResponse> => {
    const params: any = { return_json: true }
    if (userPrice) params.user_price = userPrice
    
    const response = await api.get(`/reports/products/${productId}/advanced-excel`, {
      params,
    })
    return response.data
  },
  
  generatePriceComparisonExcel: async (productId: number, date1: string, date2: string): Promise<ReportResponse> => {
    const response = await api.get(`/reports/products/${productId}/price-comparison-excel`, {
      params: { date1, date2, return_json: true }
    })
    return response.data
  },
  
  listReports: async (prefix?: string, limit?: number): Promise<ReportListResponse> => {
    const response = await api.get(`/reports/files`, {
      params: { prefix, limit },
    })
    return response.data
  },
  
  deleteReport: async (objectName: string): Promise<void> => {
    await api.delete(`/reports/files/${objectName}`)
  },
}

export const jobsApi = {
  list: async (skip = 0, limit = 100): Promise<Job[]> => {
    const response = await api.get('/jobs/', { params: { skip, limit } })
    return response.data
  },
  
  get: async (id: number): Promise<Job> => {
    const response = await api.get(`/jobs/${id}`)
    return response.data
  },
  
  getStatus: async (id: number) => {
    const response = await api.get(`/jobs/${id}/status`)
    return response.data
  },
}

export interface SchedulerConfig {
  id: number
  job_id: string
  enabled: boolean
  interval_hours: number
  interval_minutes: number
  cron_hour: number | null
  cron_minute: number | null
  created_at: string
  updated_at: string | null
}

export interface SchedulerConfigUpdate {
  enabled?: boolean
  interval_hours?: number
  interval_minutes?: number
  cron_hour?: number | null
  cron_minute?: number | null
}

export interface NextRunTime {
  job_id: string
  next_run_time: string | null
  enabled: boolean
}

export const schedulerApi = {
  list: async (): Promise<SchedulerConfig[]> => {
    const response = await api.get('/scheduler/')
    return response.data
  },
  
  get: async (jobId: string): Promise<SchedulerConfig> => {
    const response = await api.get(`/scheduler/${jobId}`)
    return response.data
  },
  
  update: async (jobId: string, data: SchedulerConfigUpdate): Promise<SchedulerConfig> => {
    const response = await api.put(`/scheduler/${jobId}`, data)
    return response.data
  },
  
  getNextRun: async (jobId: string): Promise<NextRunTime> => {
    const response = await api.get(`/scheduler/${jobId}/next-run`)
    return response.data
  },
}

export default api


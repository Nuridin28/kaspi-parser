import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi, analyticsApi } from '@/lib/api'
import { Loader2, CheckCircle2, XCircle, Clock, Package, TrendingUp, Users, BarChart3, DollarSign, Activity } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useCreateProduct, useCreateProductsBulk } from '@/hooks/useProducts'
import { useProductsWebSocket } from '@/hooks/useProductsWebSocket'
import { formatPrice } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  
  const { data: recentJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs', 0, 10],
    queryFn: () => jobsApi.list(0, 10),
    refetchInterval: 5000,
  })

  const { data: dashboardMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => analyticsApi.getDashboardMetrics(),
    refetchInterval: 30000,
  })

  const createProduct = useCreateProduct()
  const createProductsBulk = useCreateProductsBulk()

  useProductsWebSocket()

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'status_update') {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (message.status === 'completed' || message.status === 'failed') {
        setActiveJobId(null)
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      }
    }
    if (message.type === 'products_updated') {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
    }
  }

  useWebSocket(activeJobId, handleWebSocketMessage)

  const handleAddProduct = async () => {
    if (!url.trim()) return
    try {
      const job = await createProduct.mutateAsync(url)
      setUrl('')
      setActiveJobId(job.id)
    } catch (error) {
      console.error('Failed to add product:', error)
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkUrls.trim()) return

    const urls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)

    if (urls.length === 0) return

    try {
      const jobs = await createProductsBulk.mutateAsync(urls)
      setBulkUrls('')
      if (jobs.length > 0) {
        setActiveJobId(jobs[0].id)
      }
    } catch (error) {
      console.error('Failed to add products:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'parsing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Дашборд</h2>
        <p className="text-muted-foreground">
          Обзор системы и добавление товаров
        </p>
      </div>

      {isLoadingMetrics ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : dashboardMetrics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всего товаров</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics.overview.total_products}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardMetrics.overview.active_products} активных
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Продавцов</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics.overview.total_sellers}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardMetrics.overview.total_offers} предложений
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Средняя цена</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(dashboardMetrics.overview.avg_price)}</div>
                <p className="text-xs text-muted-foreground">
                  По всем товарам
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Парсинг (24ч)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics.parsing_stats.last_24h.completed}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardMetrics.parsing_stats.last_24h.failed} ошибок
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Активность</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics.parsing_stats.last_24h.total}</div>
                <p className="text-xs text-muted-foreground">
                  Задач за 24 часа
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Активность парсинга</CardTitle>
                <CardDescription>Количество задач по дням (7 дней)</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardMetrics.parsing_stats.activity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboardMetrics.parsing_stats.activity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                      />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Нет данных за последние 7 дней
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Распределение по категориям</CardTitle>
                <CardDescription>Количество товаров по категориям</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardMetrics.categories && dashboardMetrics.categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={dashboardMetrics.categories}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {dashboardMetrics.categories.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Нет категорий
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {dashboardMetrics.top_price_changes && dashboardMetrics.top_price_changes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Топ изменений цен (7 дней)
                </CardTitle>
                <CardDescription>Товары с наибольшим изменением цены</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardMetrics.top_price_changes.map((product: any) => (
                    <div
                      key={product.product_id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{product.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(product.first_price)} → {formatPrice(product.last_price)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(product.first_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} → {new Date(product.last_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${product.price_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {product.price_change > 0 ? '+' : ''}{formatPrice(product.price_change)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.price_change_percent > 0 ? '+' : ''}{product.price_change_percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Добавить товар</CardTitle>
            <CardDescription>
              Вставьте ссылку на товар с Kaspi.kz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="https://kaspi.kz/shop/p/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
            />
            <Button 
              onClick={handleAddProduct} 
              disabled={createProduct.isPending || !url.trim()}
            >
              {createProduct.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Добавление...
                </>
              ) : (
                'Добавить'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Массовое добавление</CardTitle>
            <CardDescription>
              Вставьте несколько ссылок (по одной на строку)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="https://kaspi.kz/shop/p/...&#10;https://kaspi.kz/shop/p/...&#10;..."
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
            />
            <Button 
              onClick={handleBulkAdd} 
              disabled={createProductsBulk.isPending || !bulkUrls.trim()}
            >
              {createProductsBulk.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Добавление...
                </>
              ) : (
                'Добавить все'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние задачи</CardTitle>
          <CardDescription>Статус парсинга товаров</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingJobs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет задач</p>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job: any) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="text-sm font-medium">{job.kaspi_url}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm capitalize">{job.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

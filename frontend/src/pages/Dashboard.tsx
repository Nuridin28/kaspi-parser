import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '@/lib/api'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useCreateProduct, useCreateProductsBulk } from '@/hooks/useProducts'
import { useProductsWebSocket } from '@/hooks/useProductsWebSocket'

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

  const createProduct = useCreateProduct()
  const createProductsBulk = useCreateProductsBulk()

  useProductsWebSocket()

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'status_update') {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (message.status === 'completed' || message.status === 'failed') {
        setActiveJobId(null)
        queryClient.invalidateQueries({ queryKey: ['products'] })
      }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Дашборд</h2>
        <p className="text-muted-foreground">
          Добавьте товары для парсинга и аналитики
        </p>
      </div>

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

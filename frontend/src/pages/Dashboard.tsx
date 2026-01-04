import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { productsApi, jobsApi, type Job } from '@/lib/api'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

export default function Dashboard() {
  const [url, setUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [activeJobId, setActiveJobId] = useState<number | null>(null)

  useEffect(() => {
    loadRecentJobs()
    const interval = setInterval(loadRecentJobs, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'status_update') {
      setRecentJobs(prev => prev.map(job => 
        job.id === message.job_id 
          ? { ...job, status: message.status }
          : job
      ))
      if (message.status === 'completed' || message.status === 'failed') {
        setActiveJobId(null)
        loadRecentJobs()
      }
    }
  }

  useWebSocket(activeJobId, handleWebSocketMessage)

  const loadRecentJobs = async () => {
    try {
      const jobs = await jobsApi.list(0, 10)
      setRecentJobs(jobs)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    }
  }

  const handleAddProduct = async () => {
    if (!url.trim()) return

    setIsLoading(true)
    try {
      const job = await productsApi.create(url)
      setUrl('')
      setActiveJobId(job.id)
      await loadRecentJobs()
    } catch (error) {
      console.error('Failed to add product:', error)
      alert('Ошибка при добавлении товара')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkUrls.trim()) return

    const urls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)

    if (urls.length === 0) return

    setIsLoading(true)
    try {
      await productsApi.createBulk(urls)
      setBulkUrls('')
      await loadRecentJobs()
    } catch (error) {
      console.error('Failed to add products:', error)
      alert('Ошибка при добавлении товаров')
    } finally {
      setIsLoading(false)
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
            <Button onClick={handleAddProduct} disabled={isLoading || !url.trim()}>
              {isLoading ? (
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
            <Button onClick={handleBulkAdd} disabled={isLoading || !bulkUrls.trim()}>
              {isLoading ? (
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
          <div className="space-y-2">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет задач</p>
            ) : (
              recentJobs.map((job) => (
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
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


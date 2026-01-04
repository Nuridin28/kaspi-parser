import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { productsApi, reportsApi, analyticsApi, type Product } from '@/lib/api'
import { Download, TrendingUp, TrendingDown, Minus, Calendar, Loader2, Archive } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function Reports() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct1, setSelectedProduct1] = useState<number | null>(null)
  const [selectedProduct2, setSelectedProduct2] = useState<number | null>(null)
  const [selectedProductForDates, setSelectedProductForDates] = useState<number | null>(null)
  const [date1, setDate1] = useState('')
  const [date2, setDate2] = useState('')
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [isLoadingComparison, setIsLoadingComparison] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isGeneratingComparison, setIsGeneratingComparison] = useState(false)

  useEffect(() => {
    loadProducts()
    const today = new Date().toISOString().split('T')[0]
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setDate1(fiveDaysAgo)
    setDate2(today)
  }, [])

  const loadProducts = async () => {
    try {
      const data = await productsApi.list()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const handleDownloadProductReport = async (productId: number) => {
    try {
      setIsGeneratingReport(true)
      const reportData = await reportsApi.generateProductExcel(productId)
      const link = document.createElement('a')
      link.href = reportData.url
      link.download = reportData.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('Ошибка при генерации отчета. Попробуйте еще раз.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleDownloadComparison = async () => {
    if (!selectedProduct1 || !selectedProduct2) {
      alert('Выберите два товара для сравнения')
      return
    }

    try {
      setIsGeneratingComparison(true)
      const reportData = await reportsApi.generateComparisonExcel(selectedProduct1, selectedProduct2)
      const link = document.createElement('a')
      link.href = reportData.url
      link.download = reportData.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to generate comparison:', error)
      alert('Ошибка при генерации отчета. Попробуйте еще раз.')
    } finally {
      setIsGeneratingComparison(false)
    }
  }

  const handleCompareDates = async () => {
    if (!selectedProductForDates || !date1 || !date2) {
      alert('Выберите товар и обе даты')
      return
    }

    try {
      setIsLoadingComparison(true)
      const data = await analyticsApi.comparePrices(selectedProductForDates, date1, date2)
      setComparisonData(data)
    } catch (error) {
      console.error('Failed to compare prices:', error)
      alert('Ошибка при получении данных сравнения')
    } finally {
      setIsLoadingComparison(false)
    }
  }

  const formatChange = (change: number, percent: number) => {
    const isPositive = change >= 0
    const Icon = isPositive ? TrendingUp : TrendingDown
    const color = isPositive ? 'text-green-600' : 'text-red-600'
    
    return (
      <div className={cn("flex items-center gap-1", color)}>
        <Icon className="h-4 w-4" />
        <span className="font-medium">
          {isPositive ? '+' : ''}{formatPrice(change)} ({isPositive ? '+' : ''}{percent.toFixed(2)}%)
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Отчеты</h1>
          <p className="text-muted-foreground mt-2">
            Генерация Excel-отчетов и сравнение динамики цен
          </p>
        </div>
        <Link to="/reports/archive">
          <Button variant="outline">
            <Archive className="h-4 w-4 mr-2" />
            Архив отчетов
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Сравнение цен по датам
          </CardTitle>
          <CardDescription>
            Выберите товар и две даты для сравнения динамики цен
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-select">Товар</Label>
              <select
                id="product-select"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                value={selectedProductForDates || ''}
                onChange={(e) => setSelectedProductForDates(parseInt(e.target.value) || null)}
              >
                <option value="">Выберите товар</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `Товар #${p.kaspi_id}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date1">Первая дата</Label>
                <Input
                  id="date1"
                  type="date"
                  value={date1}
                  onChange={(e) => setDate1(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="date2">Вторая дата</Label>
                <Input
                  id="date2"
                  type="date"
                  value={date2}
                  onChange={(e) => setDate2(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              onClick={handleCompareDates}
              disabled={!selectedProductForDates || !date1 || !date2 || isLoadingComparison}
              className="w-full"
            >
              {isLoadingComparison ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Сравнить цены
                </>
              )}
            </Button>

            {comparisonData && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {comparisonData.product_name || `Товар #${comparisonData.product_id}`}
                  </h3>
                </div>

                {comparisonData.date1 && comparisonData.date2 && comparisonData.price_change && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Минимальная цена</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date1.date}: {formatPrice(comparisonData.date1.min_price)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date2.date}: {formatPrice(comparisonData.date2.min_price)}
                          </div>
                          <div className="pt-2 border-t">
                            {formatChange(
                              comparisonData.price_change.min_change,
                              comparisonData.price_change.min_change_percent
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Средняя цена</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date1.date}: {formatPrice(comparisonData.date1.avg_price)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date2.date}: {formatPrice(comparisonData.date2.avg_price)}
                          </div>
                          <div className="pt-2 border-t">
                            {formatChange(
                              comparisonData.price_change.avg_change,
                              comparisonData.price_change.avg_change_percent
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Максимальная цена</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date1.date}: {formatPrice(comparisonData.date1.max_price)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {comparisonData.date2.date}: {formatPrice(comparisonData.date2.max_price)}
                          </div>
                          <div className="pt-2 border-t">
                            {formatChange(
                              comparisonData.price_change.max_change,
                              comparisonData.price_change.max_change_percent
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {comparisonData.date1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Данные за {comparisonData.date1.date}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Предложений: </span>
                          <span className="font-medium">{comparisonData.date1.offers_count}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Мин: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date1.min_price)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Макс: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date1.max_price)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Средняя: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date1.avg_price)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {comparisonData.date2 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Данные за {comparisonData.date2.date}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Предложений: </span>
                          <span className="font-medium">{comparisonData.date2.offers_count}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Мин: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date2.min_price)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Макс: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date2.max_price)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Средняя: </span>
                          <span className="font-medium">{formatPrice(comparisonData.date2.avg_price)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {!comparisonData.date1 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Нет данных за {date1}
                    </p>
                  </div>
                )}

                {!comparisonData.date2 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Нет данных за {date2}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Отчет по товару</CardTitle>
          <CardDescription>
            Скачайте детальный отчет по выбранному товару
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedProduct1 || ''}
              onChange={(e) => setSelectedProduct1(parseInt(e.target.value) || null)}
            >
              <option value="">Выберите товар</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || `Товар #${p.kaspi_id}`}
                </option>
              ))}
            </select>
            <Button
              onClick={() => selectedProduct1 && handleDownloadProductReport(selectedProduct1)}
              disabled={!selectedProduct1 || isGeneratingReport}
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать отчет
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сравнение товаров</CardTitle>
          <CardDescription>
            Сравните два товара в одном Excel-файле
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Товар 1</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProduct1 || ''}
                onChange={(e) => setSelectedProduct1(parseInt(e.target.value) || null)}
              >
                <option value="">Выберите товар</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `Товар #${p.kaspi_id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Товар 2</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProduct2 || ''}
                onChange={(e) => setSelectedProduct2(parseInt(e.target.value) || null)}
              >
                <option value="">Выберите товар</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `Товар #${p.kaspi_id}`}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleDownloadComparison}
              disabled={!selectedProduct1 || !selectedProduct2 || isGeneratingComparison}
            >
              {isGeneratingComparison ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать сравнение
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

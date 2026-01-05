import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { productsApi, analyticsApi, reportsApi, type Product, type PositionEstimate } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { Loader2, Download, TrendingUp, TrendingDown, AlertTriangle, Brain, BarChart3, Target, DollarSign, TrendingDown as TrendingDownIcon, Zap, Shield, AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Analytics() {
  const [searchParams] = useSearchParams()
  const productIdParam = searchParams.get('product')
  
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [userPrice, setUserPrice] = useState('')
  const [positionEstimate, setPositionEstimate] = useState<PositionEstimate | null>(null)
  const [statistics, setStatistics] = useState<any>(null)
  const [advancedAnalytics, setAdvancedAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAdvanced, setIsLoadingAdvanced] = useState(false)
  const [scenarioPrice, setScenarioPrice] = useState('')
  const [scenarioAnalysis, setScenarioAnalysis] = useState<any>(null)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [comparisonDate1, setComparisonDate1] = useState('')
  const [comparisonDate2, setComparisonDate2] = useState('')
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [isLoadingComparison, setIsLoadingComparison] = useState(false)
  const [isGeneratingComparisonReport, setIsGeneratingComparisonReport] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (productIdParam) {
      const productId = parseInt(productIdParam)
      loadProduct(productId)
    }
  }, [productIdParam])

  const loadProducts = async () => {
    try {
      const data = await productsApi.list()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const loadProduct = async (id: number) => {
    try {
      const product = await productsApi.get(id)
      setSelectedProduct(product)
      await loadStatistics(id)
      await loadPriceHistory(id)
    } catch (error) {
      console.error('Failed to load product:', error)
    }
  }

  const loadPriceHistory = async (productId: number) => {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      const history = await analyticsApi.getPriceHistory(
        productId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      setPriceHistory(history)
    } catch (error) {
      console.error('Failed to load price history:', error)
    }
  }

  const loadStatistics = async (productId: number) => {
    try {
      const stats = await analyticsApi.getStatistics(productId)
      setStatistics(stats)
    } catch (error) {
      console.error('Failed to load statistics:', error)
    }
  }

  const handleComparePrices = async () => {
    if (!selectedProduct || !comparisonDate1 || !comparisonDate2) return

    setIsLoadingComparison(true)
    try {
      const data = await analyticsApi.comparePrices(
        selectedProduct.id,
        comparisonDate1,
        comparisonDate2
      )
      setComparisonData(data)
    } catch (error) {
      console.error('Failed to compare prices:', error)
      alert('Ошибка при сравнении цен. Убедитесь, что для выбранных дат есть данные.')
    } finally {
      setIsLoadingComparison(false)
    }
  }

  const handleDownloadComparisonReport = async () => {
    if (!selectedProduct || !comparisonDate1 || !comparisonDate2) return

    setIsGeneratingComparisonReport(true)
    try {
      const result = await reportsApi.generatePriceComparisonExcel(
        selectedProduct.id,
        comparisonDate1,
        comparisonDate2
      )
      const link = document.createElement('a')
      link.href = result.url
      link.download = result.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to generate comparison report:', error)
      alert('Ошибка при генерации отчета')
    } finally {
      setIsGeneratingComparisonReport(false)
    }
  }

  const handleEstimatePosition = async () => {
    if (!selectedProduct || !userPrice) return

    const price = parseFloat(userPrice)
    if (isNaN(price) || price <= 0) {
      alert('Введите корректную цену')
      return
    }

    setIsLoading(true)
    try {
      const estimate = await analyticsApi.estimatePosition(selectedProduct.id, price)
      setPositionEstimate(estimate)
    } catch (error) {
      console.error('Failed to estimate position:', error)
      alert('Ошибка при расчете позиции')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadAdvancedAnalytics = async () => {
    if (!selectedProduct) return

    setIsLoadingAdvanced(true)
    try {
      const price = userPrice ? parseFloat(userPrice) : undefined
      const data = await analyticsApi.getAdvancedAnalytics(selectedProduct.id, price)
      setAdvancedAnalytics(data)
    } catch (error) {
      console.error('Failed to load advanced analytics:', error)
      alert('Ошибка при загрузке расширенной аналитики')
    } finally {
      setIsLoadingAdvanced(false)
    }
  }

  const handleDownloadAdvancedReport = async () => {
    if (!selectedProduct) return

    try {
      const price = userPrice ? parseFloat(userPrice) : undefined
      const reportData = await reportsApi.generateAdvancedAnalyticsExcel(selectedProduct.id, price)
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
    }
  }

  const handleAnalyzeScenario = async () => {
    if (!selectedProduct || !userPrice || !scenarioPrice) return

    const current = parseFloat(userPrice)
    const scenario = parseFloat(scenarioPrice)
    
    if (isNaN(current) || isNaN(scenario) || current <= 0 || scenario <= 0) {
      alert('Введите корректные цены')
      return
    }

    setIsLoading(true)
    try {
      const analysis = await analyticsApi.analyzeScenario(selectedProduct.id, scenario, current)
      setScenarioAnalysis(analysis)
    } catch (error) {
      console.error('Failed to analyze scenario:', error)
      alert('Ошибка при анализе сценария')
    } finally {
      setIsLoading(false)
    }
  }

  const formatChange = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    const isPositive = value >= 0
    const Icon = isPositive ? TrendingUp : TrendingDown
    const color = isPositive ? 'text-green-600' : 'text-red-600'
    
    return (
      <div className={cn("flex items-center gap-1", color)}>
        <Icon className="h-4 w-4" />
        <span>{value > 0 ? '+' : ''}{value.toFixed(2)}</span>
      </div>
    )
  }

  const formatAIInsights = (text: string) => {
    if (!text) return null

    const sections = text.split(/(?=### \d+\.)/).filter(s => s.trim())
    
    const insightIcons: Record<string, any> = {
      'sweet spot': Target,
      'цено': DollarSign,
      'дешевле': TrendingDownIcon,
      'входить': Zap,
      'выиграть': Shield,
      'контролирует': AlertCircle,
      'ломается': AlertTriangle,
      'рекомендации': Lightbulb,
    }

    const getIconForSection = (title: string) => {
      const lowerTitle = title.toLowerCase()
      for (const [key, icon] of Object.entries(insightIcons)) {
        if (lowerTitle.includes(key)) return icon
      }
      return Lightbulb
    }

    return (
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const trimmed = section.trim()
          if (!trimmed) return null

          const headerMatch = trimmed.match(/^###\s+(\d+)\.\s+(.+?)(?=\n|$)/)
          if (!headerMatch) return null

          const [, number, title] = headerMatch
          let content = trimmed.replace(/^###\s+\d+\.\s+.+?\n?/, '').trim()
          
          const listLines = content.split('\n').filter(l => l.trim().match(/^[-•]\s+/))
          let listItems: string[] = []
          if (listLines.length > 0) {
            const listStart = content.indexOf(listLines[0])
            if (listStart >= 0) {
              listItems = listLines.map(item => item.replace(/^[-•]\s+/, '').trim())
              content = content.substring(0, listStart).trim()
            }
          }

          const paragraphs = content
            .split(/\n\s*\n/)
            .filter(p => p.trim() && !p.trim().match(/^###/))
            .map(p => p.trim().replace(/\n/g, ' '))

          const Icon = getIconForSection(title)

          return (
            <Card key={idx} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start gap-3 text-xl">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {number}
                      </span>
                      <span className="font-semibold">{title}</span>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paragraphs.map((paragraph, pIdx) => (
                  <p key={pIdx} className="text-muted-foreground leading-relaxed text-base">
                    {paragraph}
                  </p>
                ))}
                
                {listItems.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    {listItems.map((item, itemIdx) => {
                      const boldMatch = item.match(/^\*\*(.+?)\*\*:\s*(.+)$/)
                      if (boldMatch) {
                        const [, boldText, restText] = boldMatch
                        return (
                          <div key={itemIdx} className="flex gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-semibold text-foreground">{boldText}:</span>
                              <span className="text-muted-foreground"> {restText}</span>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={itemIdx} className="flex gap-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <p className="text-muted-foreground">{item}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Аналитика</h2>
        <p className="text-muted-foreground">
          Расширенный анализ цен, позиций и конкурентной среды
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Выбор товара</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedProduct?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value)
              if (id) loadProduct(id)
            }}
          >
            <option value="">Выберите товар</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || `Товар #${p.kaspi_id}`}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedProduct && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{selectedProduct.name || `Товар #${selectedProduct.kaspi_id}`}</CardTitle>
              <CardDescription>{selectedProduct.category || 'Без категории'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statistics && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Мин. цена</p>
                      <p className="text-2xl font-bold">
                        {statistics.min_price ? formatPrice(statistics.min_price) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Макс. цена</p>
                      <p className="text-2xl font-bold">
                        {statistics.max_price ? formatPrice(statistics.max_price) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Средняя цена</p>
                      <p className="text-2xl font-bold">
                        {statistics.avg_price ? formatPrice(statistics.avg_price) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Предложений</p>
                      <p className="text-2xl font-bold">{statistics.offers_count || 0}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {priceHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>История цен (30 дней)</CardTitle>
                <CardDescription>Динамика изменения цен</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceHistory.map(h => ({
                    date: new Date(h.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
                    min: h.min_price,
                    max: h.max_price,
                    avg: h.avg_price
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatPrice(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="min" stroke="#ef4444" name="Мин. цена" />
                    <Line type="monotone" dataKey="avg" stroke="#3b82f6" name="Средняя цена" />
                    <Line type="monotone" dataKey="max" stroke="#10b981" name="Макс. цена" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Сравнение цен по датам</CardTitle>
              <CardDescription>Сравните цены товара на две разные даты</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="date1">Дата 1</Label>
                  <Input
                    id="date1"
                    type="date"
                    value={comparisonDate1}
                    onChange={(e) => setComparisonDate1(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="date2">Дата 2</Label>
                  <Input
                    id="date2"
                    type="date"
                    value={comparisonDate2}
                    onChange={(e) => setComparisonDate2(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleComparePrices}
                  disabled={isLoadingComparison || !comparisonDate1 || !comparisonDate2 || !selectedProduct}
                >
                  {isLoadingComparison ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Сравнить
                    </>
                  )}
                </Button>
                {comparisonData && (
                  <Button
                    onClick={handleDownloadComparisonReport}
                    disabled={isGeneratingComparisonReport}
                    variant="outline"
                  >
                    {isGeneratingComparisonReport ? (
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
                )}
              </div>
              {comparisonData && (
                <div className="mt-4 p-4 border rounded-md bg-muted">
                  <h3 className="font-semibold mb-3">Результаты сравнения</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Дата 1 ({comparisonData.date1?.date})</p>
                      <div className="space-y-1">
                        <p className="text-sm">Мин. цена: <span className="font-semibold">{formatPrice(comparisonData.date1?.min_price)}</span></p>
                        <p className="text-sm">Макс. цена: <span className="font-semibold">{formatPrice(comparisonData.date1?.max_price)}</span></p>
                        <p className="text-sm">Средняя цена: <span className="font-semibold">{formatPrice(comparisonData.date1?.avg_price)}</span></p>
                        <p className="text-sm">Предложений: <span className="font-semibold">{comparisonData.date1?.offers_count}</span></p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Дата 2 ({comparisonData.date2?.date})</p>
                      <div className="space-y-1">
                        <p className="text-sm">Мин. цена: <span className="font-semibold">{formatPrice(comparisonData.date2?.min_price)}</span></p>
                        <p className="text-sm">Макс. цена: <span className="font-semibold">{formatPrice(comparisonData.date2?.max_price)}</span></p>
                        <p className="text-sm">Средняя цена: <span className="font-semibold">{formatPrice(comparisonData.date2?.avg_price)}</span></p>
                        <p className="text-sm">Предложений: <span className="font-semibold">{comparisonData.date2?.offers_count}</span></p>
                      </div>
                    </div>
                  </div>
                  {comparisonData.price_change && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-semibold mb-2">Изменения:</p>
                      <div className="space-y-1">
                        <p className="text-sm">
                          Мин. цена: {comparisonData.price_change.min_change >= 0 ? '+' : ''}{formatPrice(comparisonData.price_change.min_change)} 
                          ({comparisonData.price_change.min_change_percent >= 0 ? '+' : ''}{comparisonData.price_change.min_change_percent.toFixed(2)}%)
                        </p>
                        <p className="text-sm">
                          Макс. цена: {comparisonData.price_change.max_change >= 0 ? '+' : ''}{formatPrice(comparisonData.price_change.max_change)}
                          ({comparisonData.price_change.max_change_percent >= 0 ? '+' : ''}{comparisonData.price_change.max_change_percent.toFixed(2)}%)
                        </p>
                        <p className="text-sm">
                          Средняя цена: {comparisonData.price_change.avg_change >= 0 ? '+' : ''}{formatPrice(comparisonData.price_change.avg_change)}
                          ({comparisonData.price_change.avg_change_percent >= 0 ? '+' : ''}{comparisonData.price_change.avg_change_percent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Оценка позиции</CardTitle>
              <CardDescription>
                Введите вашу цену, чтобы узнать предполагаемую позицию
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="user-price">Ваша цена (тенге)</Label>
                <Input
                  id="user-price"
                  type="number"
                  placeholder="10000"
                  value={userPrice}
                  onChange={(e) => setUserPrice(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEstimatePosition} disabled={isLoading || !userPrice}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Расчет...
                    </>
                  ) : (
                    'Рассчитать позицию'
                  )}
                </Button>
                <Button 
                  onClick={handleLoadAdvancedAnalytics} 
                  disabled={isLoadingAdvanced}
                  variant="outline"
                >
                  {isLoadingAdvanced ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Расширенная аналитика
                    </>
                  )}
                </Button>
                {advancedAnalytics && (
                  <Button onClick={handleDownloadAdvancedReport} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Скачать отчет
                  </Button>
                )}
              </div>

              {positionEstimate && (
                <div className="mt-4 p-4 border rounded-md bg-muted">
                  <h3 className="font-semibold mb-2">Результат:</h3>
                  <div className="space-y-1">
                    <p>
                      <span className="text-muted-foreground">Ваша цена:</span>{' '}
                      <span className="font-semibold">{formatPrice(positionEstimate.user_price)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Предполагаемая позиция:</span>{' '}
                      <span className="font-semibold">
                        {positionEstimate.estimated_position} из {positionEstimate.total_sellers}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Процентиль:</span>{' '}
                      <span className="font-semibold">{positionEstimate.percentile.toFixed(1)}%</span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {advancedAnalytics && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Распределение цен
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Мин</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.min)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">P25</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.p25)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Медиана</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.median)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">P75</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.p75)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Макс</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.max)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">IQR</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.iqr)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Средняя</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.mean)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ст. отклонение</p>
                      <p className="text-xl font-bold">{formatPrice(advancedAnalytics.price_distribution?.std)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Волатильность и тренды</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Коэффициент вариации:</span>
                      <span className="font-medium">{advancedAnalytics.volatility?.coefficient_of_variation?.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Направление тренда:</span>
                      <span className="font-medium">{advancedAnalytics.trend?.direction || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Изменение:</span>
                      {formatChange(advancedAnalytics.trend?.change_percent)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Спрос и конкуренция</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Оценка спроса:</span>
                      <span className="font-medium">{(advancedAnalytics.demand_proxy?.demand_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Продавцов:</span>
                      <span className="font-medium">{advancedAnalytics.demand_proxy?.sellers_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Конкуренция:</span>
                      <span className="font-medium">{advancedAnalytics.demand_proxy?.competition_level || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Барьер входа:</span>
                      <span className="font-medium">{advancedAnalytics.entry_barrier?.level || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Оптимальная цена</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Рекомендуемая цена:</span>
                      <span className="font-bold text-lg">{formatPrice(advancedAnalytics.optimal_price?.optimal_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Позиция:</span>
                      <span className="font-medium">{advancedAnalytics.optimal_price?.estimated_position || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Маржа:</span>
                      <span className="font-medium">{advancedAnalytics.optimal_price?.margin_percent?.toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                {advancedAnalytics.anomalies && advancedAnalytics.anomalies.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        Аномалии
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {advancedAnalytics.anomalies.slice(0, 3).map((anomaly: any, idx: number) => (
                          <div key={idx} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                            {anomaly.message}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {advancedAnalytics.dominant_sellers && advancedAnalytics.dominant_sellers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Доминирующие продавцы</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {advancedAnalytics.dominant_sellers.slice(0, 5).map((seller: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 border rounded">
                          <span className="font-medium">{seller.seller_name}</span>
                          <div className="text-sm text-muted-foreground">
                            TOP-3: {seller.top3_frequency}x | Позиция: {seller.avg_position?.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {advancedAnalytics.ai_insights && (
                <div className="space-y-4">
                  <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-2xl">
                        <div className="p-2 rounded-lg bg-primary/20">
                          <Brain className="h-6 w-6 text-primary" />
                        </div>
                        AI-Генерированные инсайты
                      </CardTitle>
                      <CardDescription className="text-base">
                        Стратегические рекомендации на основе анализа рынка
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  {formatAIInsights(advancedAnalytics.ai_insights)}
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Анализ сценария (What-If)</CardTitle>
              <CardDescription>
                Проанализируйте, что произойдет при изменении цены
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current-price">Текущая цена</Label>
                  <Input
                    id="current-price"
                    type="number"
                    value={userPrice}
                    onChange={(e) => setUserPrice(e.target.value)}
                    placeholder="10000"
                  />
                </div>
                <div>
                  <Label htmlFor="scenario-price">Сценарий цена</Label>
                  <Input
                    id="scenario-price"
                    type="number"
                    value={scenarioPrice}
                    onChange={(e) => setScenarioPrice(e.target.value)}
                    placeholder="9500"
                  />
                </div>
              </div>
              <Button onClick={handleAnalyzeScenario} disabled={isLoading || !userPrice || !scenarioPrice}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализ...
                  </>
                ) : (
                  'Проанализировать сценарий'
                )}
              </Button>

              {scenarioAnalysis && (
                <div className="mt-4 p-4 border rounded-md bg-muted">
                  <h3 className="font-semibold mb-2">Результат анализа:</h3>
                  <div className="space-y-2">
                    <p>
                      <span className="text-muted-foreground">Изменение цены:</span>{' '}
                      <span className="font-semibold">
                        {scenarioAnalysis.price_change_percent > 0 ? '+' : ''}
                        {scenarioAnalysis.price_change_percent.toFixed(2)}%
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Новая позиция:</span>{' '}
                      <span className="font-semibold">
                        {scenarioAnalysis.estimated_position}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Процентиль:</span>{' '}
                      <span className="font-semibold">{scenarioAnalysis.percentile.toFixed(1)}%</span>
                    </p>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm whitespace-pre-wrap">{scenarioAnalysis.analysis}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Текущие предложения</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedProduct.offers.slice(0, 10).map((offer, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div>
                      <p className="font-medium">{offer.seller_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Рейтинг: {offer.seller_rating || 'N/A'} | Отзывов: {offer.seller_reviews_count}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatPrice(offer.price)}</p>
                      <p className="text-sm text-muted-foreground">
                        Позиция: {offer.position || '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

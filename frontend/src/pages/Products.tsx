import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { productsApi, type Product } from '@/lib/api'
import { formatPrice, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ExternalLink, 
  Edit2, 
  Trash2, 
  Loader2,
  Package,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isParsing, setIsParsing] = useState<Record<number, boolean>>({})
  const [editForm, setEditForm] = useState({ name: '', category: '' })

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const data = await productsApi.list()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name || '',
      category: product.category || ''
    })
  }

  const handleSave = async () => {
    if (!editingProduct) return

    try {
      setIsSaving(true)
      await productsApi.update(editingProduct.id, {
        name: editForm.name || undefined,
        category: editForm.category || undefined,
      })
      await loadProducts()
      setEditingProduct(null)
    } catch (error) {
      console.error('Failed to update product:', error)
      alert('Ошибка при обновлении товара')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (productId: number) => {
    try {
      setIsDeleting(true)
      await productsApi.delete(productId)
      await loadProducts()
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Ошибка при удалении товара')
    } finally {
      setIsDeleting(false)
    }
  }

  const getDataFreshness = (lastParsedAt: string | null) => {
    if (!lastParsedAt) return { status: 'unknown', text: 'Не парсился', color: 'text-muted-foreground', icon: AlertCircle }
    
    const parsedDate = new Date(lastParsedAt)
    const now = new Date()
    const diffHours = (now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60)
    
    if (diffHours < 1) {
      return { status: 'fresh', text: 'Только что', color: 'text-green-600', icon: CheckCircle2 }
    } else if (diffHours < 6) {
      return { status: 'fresh', text: `${Math.floor(diffHours)} ч. назад`, color: 'text-green-600', icon: CheckCircle2 }
    } else if (diffHours < 24) {
      return { status: 'stale', text: `${Math.floor(diffHours)} ч. назад`, color: 'text-yellow-600', icon: AlertTriangle }
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return { status: 'old', text: `${diffDays} дн. назад`, color: 'text-red-600', icon: AlertCircle }
    }
  }

  const formatLastParsed = (lastParsedAt: string | null) => {
    if (!lastParsedAt) return 'Никогда'
    const date = new Date(lastParsedAt)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleParse = async (productId: number) => {
    try {
      setIsParsing(prev => ({ ...prev, [productId]: true }))
      await productsApi.parse(productId)
      setTimeout(async () => {
        await loadProducts()
        setIsParsing(prev => ({ ...prev, [productId]: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to parse product:', error)
      alert('Ошибка при парсинге товара')
      setIsParsing(prev => ({ ...prev, [productId]: false }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка товаров...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Товары</h2>
        <p className="text-muted-foreground">
          Список всех отслеживаемых товаров
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <Card 
            key={product.id}
            className="group hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="line-clamp-2 text-lg group-hover:text-primary transition-colors">
                    {product.name || `Товар #${product.kaspi_id}`}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {product.category || 'Без категории'}
                  </CardDescription>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(product)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Предложений</p>
                    <p className="text-xl font-semibold">{product.offers.length}</p>
                  </div>
                  {product.offers.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Диапазон цен</p>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-green-600">
                          {formatPrice(Math.min(...product.offers.map(o => o.price)))}
                        </span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-orange-600">
                          {formatPrice(Math.max(...product.offers.map(o => o.price)))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {product.last_parsed_at && (
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Последний парсинг</p>
                          <p className="text-sm font-medium">{formatLastParsed(product.last_parsed_at)}</p>
                        </div>
                      </div>
                      {(() => {
                        const freshness = getDataFreshness(product.last_parsed_at)
                        const Icon = freshness.icon
                        return (
                          <div className={cn("flex items-center gap-1", freshness.color)}>
                            <Icon className="h-4 w-4" />
                            <span className="text-xs font-medium">{freshness.text}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
                
                {!product.last_parsed_at && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        Данные еще не были спарсены
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleParse(product.id)}
                    disabled={isParsing[product.id]}
                  >
                    {isParsing[product.id] ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Парсинг...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Обновить данные
                      </>
                    )}
                  </Button>
                  <Link to={`/analytics?product=${product.id}`} className="flex-1">
                    <Button variant="outline" className="w-full group/btn">
                      Аналитика
                      <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Нет товаров</h3>
                <p className="text-muted-foreground mb-4">
                  Начните отслеживать товары, добавив первый товар
                </p>
                <Link to="/">
                  <Button>
                    Добавить товар
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
            <DialogDescription>
              Измените название и категорию товара. Нажмите сохранить когда закончите.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Введите название товара"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Категория</Label>
              <Input
                id="category"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="Введите категорию"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProduct(null)}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Подтвердите удаление
            </DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.
              Все связанные данные (предложения, история цен, аналитика) также будут удалены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

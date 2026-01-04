import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProducts, useUpdateProduct, useDeleteProduct, useParseProduct } from '@/hooks/useProducts'
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
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useProductsWebSocket } from '@/hooks/useProductsWebSocket'

export default function Products() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const { data: products = [], isLoading, refetch } = useProducts(0, 100, searchQuery || undefined)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const parseProduct = useParseProduct()
  
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '' })
  const [activeParseJobId, setActiveParseJobId] = useState<number | null>(null)

  useProductsWebSocket()

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'status_update') {
      if (message.status === 'completed' || message.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        setActiveParseJobId(null)
      }
    }
  }

  useWebSocket(activeParseJobId, handleWebSocketMessage)

  const handleEdit = (product: any) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name || '',
      category: product.category || ''
    })
  }

  const handleSave = async () => {
    if (!editingProduct) return
    updateProduct.mutate({
      id: editingProduct.id,
      data: {
        name: editForm.name || undefined,
        category: editForm.category || undefined,
      }
    })
    setEditingProduct(null)
  }

  const handleDelete = async (productId: number) => {
    deleteProduct.mutate(productId)
    setDeleteConfirm(null)
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
      const job = await parseProduct.mutateAsync(productId)
      if (job?.id) {
        setActiveParseJobId(job.id)
      }
    } catch (error) {
      console.error('Failed to parse product:', error)
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
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Товары</h2>
          <p className="text-muted-foreground">
            Список всех отслеживаемых товаров
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Поиск по названию или категории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => refetch()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Товары не найдены' : 'Нет товаров. Добавьте первый товар на главной странице.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => {
            const freshness = getDataFreshness(product.last_parsed_at)
            const FreshnessIcon = freshness.icon
            const minPrice = product.offers && product.offers.length > 0 
              ? Math.min(...product.offers.map((o: any) => o.price))
              : null
            const isParsing = activeParseJobId !== null

            return (
              <Card 
                key={product.id}
                className="group hover:shadow-lg transition-all duration-300"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="line-clamp-2 text-lg group-hover:text-primary transition-colors">
                        {product.name || `Товар #${product.kaspi_id}`}
                      </CardTitle>
                      {product.category && (
                        <CardDescription className="mt-1 line-clamp-1">
                          {product.category}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(product.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FreshnessIcon className={cn("h-4 w-4", freshness.color)} />
                      <span className={cn("text-sm", freshness.color)}>
                        {freshness.text}
                      </span>
                    </div>
                    {minPrice && (
                      <div className="flex items-center gap-1 text-lg font-bold">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        {formatPrice(minPrice)}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Kaspi ID:</span>
                      <span className="font-mono">{product.kaspi_id}</span>
                    </div>
                    {product.last_parsed_at && (
                      <div className="flex justify-between">
                        <span>Обновлен:</span>
                        <span>{formatLastParsed(product.last_parsed_at)}</span>
                      </div>
                    )}
                    {product.offers && product.offers.length > 0 && (
                      <div className="flex justify-between">
                        <span>Предложений:</span>
                        <span>{product.offers.length}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleParse(product.id)}
                      disabled={isParsing}
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Парсинг...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Обновить
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-9"
                    >
                      <Link to={`/analytics?product=${product.id}`}>
                        Аналитика
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                      className="h-9 w-9 flex items-center justify-center"
                    >
                      <a
                        href={`https://kaspi.kz/shop/p/${product.kaspi_id}/?c=750000000`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
            <DialogDescription>
              Измените название или категорию товара
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Название</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Название товара"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Категория</Label>
              <Input
                id="edit-category"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="Категория товара"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={updateProduct.isPending}>
              {updateProduct.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердите удаление</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

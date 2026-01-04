import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, type Product } from '@/lib/api'
import { toast } from 'sonner'

export const useProducts = (skip = 0, limit = 100, search?: string) => {
  return useQuery({
    queryKey: ['products', skip, limit, search],
    queryFn: () => productsApi.list(skip, limit, search),
    staleTime: 1000 * 60 * 2,
  })
}

export const useProduct = (id: number) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id),
    enabled: !!id,
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (url: string) => productsApi.create(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Товар добавлен в очередь парсинга')
    },
    onError: (error: any) => {
      toast.error(`Ошибка при добавлении товара: ${error.message || 'Неизвестная ошибка'}`)
    },
  })
}

export const useCreateProductsBulk = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (urls: string[]) => productsApi.createBulk(urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Товары добавлены в очередь парсинга')
    },
    onError: (error: any) => {
      toast.error(`Ошибка при добавлении товаров: ${error.message || 'Неизвестная ошибка'}`)
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; category?: string } }) =>
      productsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
      toast.success('Товар обновлен')
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении товара: ${error.message || 'Неизвестная ошибка'}`)
    },
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Товар удален')
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении товара: ${error.message || 'Неизвестная ошибка'}`)
    },
  })
}

export const useParseProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => productsApi.parse(id),
    onSuccess: (job, productId) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      toast.success('Парсинг товара запущен')
      return job
    },
    onError: (error: any) => {
      toast.error(`Ошибка при парсинге товара: ${error.message || 'Неизвестная ошибка'}`)
    },
  })
}


import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useProductsWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/products`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Products WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === 'product_updated') {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          queryClient.invalidateQueries({ queryKey: ['product', message.product_id] })
          toast.success('Товар обновлен')
        } else if (message.type === 'products_updated') {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          if (message.product_ids && message.product_ids.length > 0) {
            message.product_ids.forEach((id: number) => {
              queryClient.invalidateQueries({ queryKey: ['product', id] })
            })
          }
          toast.success(message.message || `Обновлено ${message.product_ids?.length || 0} товаров`)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('Products WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Products WebSocket disconnected')
    }

    return () => {
      ws.close()
    }
  }, [queryClient])
}


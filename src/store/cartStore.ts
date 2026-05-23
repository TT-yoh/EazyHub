import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  company_name: string
  unit: string
  max_stock: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getSubtotal: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.product_id === item.product_id)

        if (existing) {
          const newQuantity = Math.min(existing.quantity + (item.quantity || 1), existing.max_stock)
          get().updateQuantity(item.product_id, newQuantity)
        } else {
          set({
            items: [
              ...get().items,
              {
                ...item,
                quantity: item.quantity || 1,
                id: crypto.randomUUID(),
              },
            ],
          })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.product_id !== productId) })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.product_id === productId ? { ...i, quantity: Math.min(quantity, i.max_stock) } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      },
    }),
    { name: 'eazyhub-cart' }
  )
)
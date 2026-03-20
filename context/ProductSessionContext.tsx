'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export interface Product {
  name: string
  category: string
  price: string
  description: string
  landing_page_url: string
  image_filename: string
  imageFile: File | null
}

export interface ReviewResult {
  product: Product
  approved: boolean
  finalDescription: string
}

interface ProductSessionState {
  products: Product[]
  setProducts: (products: Product[]) => void
  results: ReviewResult[]
  addResult: (result: ReviewResult) => void
  approvedCount: number
  skippedCount: number
  locationId: string
  setLocationId: (id: string) => void
  accountId: string
  setAccountId: (id: string) => void
  selectedLocationName: string
  setSelectedLocationName: (name: string) => void
  reset: () => void
}

const ProductSessionContext = createContext<ProductSessionState | null>(null)

export function ProductSessionProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [results, setResults] = useState<ReviewResult[]>([])
  const [locationId, setLocationId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [selectedLocationName, setSelectedLocationName] = useState('')

  const addResult = (result: ReviewResult) => {
    setResults(prev => [...prev, result])
  }

  const approvedCount = results.filter(r => r.approved).length
  const skippedCount = results.filter(r => !r.approved).length

  const reset = () => {
    setProducts([])
    setResults([])
    setLocationId('')
    setAccountId('')
    setSelectedLocationName('')
  }

  return (
    <ProductSessionContext.Provider value={{
      products, setProducts,
      results, addResult,
      approvedCount, skippedCount,
      locationId, setLocationId,
      accountId, setAccountId,
      selectedLocationName, setSelectedLocationName,
      reset,
    }}>
      {children}
    </ProductSessionContext.Provider>
  )
}

export function useProductSession() {
  const ctx = useContext(ProductSessionContext)
  if (!ctx) throw new Error('useProductSession must be used within ProductSessionProvider')
  return ctx
}

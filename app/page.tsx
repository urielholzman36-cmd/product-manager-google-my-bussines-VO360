'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useProductSession } from '@/context/ProductSessionContext'
import { parseFile } from '@/lib/parseCSV'
import type { Product } from '@/context/ProductSessionContext'

export default function UploadPage() {
  const router = useRouter()
  const { setProducts } = useProductSession()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<Omit<Product, 'imageFile'>[]>([])
  const csvRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const handleCSV = async (file: File) => {
    setCsvFile(file)
    setStatus({ message: 'Parsing file...', type: 'info' })
    const result = await parseFile(file)
    if (result.errors.length > 0) {
      setStatus({ message: result.errors[0], type: 'error' })
      setIsReady(false)
      return
    }
    setParsedProducts(result.products)
    setProductCount(result.products.length)
    setStatus({ message: `Found ${result.products.length} products`, type: 'success' })
    setIsReady(imageFiles.length > 0)
  }

  const handleImages = (files: FileList) => {
    const arr = Array.from(files).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
    const oversized = arr.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length > 0) {
      setStatus({ message: `Images too large (>10MB): ${oversized.map(f => f.name).join(', ')}. Please compress them.`, type: 'error' })
      return
    }
    const largeWarnings = arr.filter(f => f.size > 5 * 1024 * 1024)
    if (largeWarnings.length > 0) {
      setStatus({ message: `Warning: ${largeWarnings.length} image(s) are over 5MB. Consider compressing for faster uploads.`, type: 'info' })
    }
    setImageFiles(arr)
    setIsReady(parsedProducts.length > 0)
  }

  const handleStart = () => {
    const imageMap = new Map(imageFiles.map(f => [f.name, f]))
    const products: Product[] = parsedProducts.map(p => ({
      ...p,
      imageFile: imageMap.get(p.image_filename) ?? null,
    }))
    setProducts(products)
    router.push('/review')
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-4 flex justify-between items-center">
        <h1 className="text-[#4ecca3] font-bold text-xl">GMB Product Uploader</h1>
        <a href="/api/auth/login" className="border border-[#4ecca3] text-[#4ecca3] text-sm px-4 py-2 rounded-full">
          Connect with Google
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Upload Your Products</h2>
            <p className="text-gray-400 mt-2">Drop your CSV and images folder to get started</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => csvRef.current?.click()}
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-[#4ecca3] transition-colors bg-[#16213e]"
            >
              <div className="text-4xl mb-2">📊</div>
              <div className="font-bold">{csvFile ? csvFile.name : 'Select CSV or Excel'}</div>
              <div className="text-gray-400 text-sm mt-1">{productCount != null ? `${productCount} products found` : 'CSV or Excel file'}</div>
            </button>
            <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} />

            <button
              onClick={() => imgRef.current?.click()}
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-[#4ecca3] transition-colors bg-[#16213e]"
            >
              <div className="text-4xl mb-2">🖼️</div>
              <div className="font-bold">{imageFiles.length > 0 ? 'Images selected' : 'Select Images Folder'}</div>
              <div className="text-gray-400 text-sm mt-1">{imageFiles.length > 0 ? `${imageFiles.length} images` : 'JPG, PNG, WEBP'}</div>
            </button>
            <input ref={imgRef} type="file" multiple className="hidden"
              // @ts-expect-error webkitdirectory not in types
              webkitdirectory=""
              onChange={e => e.target.files && handleImages(e.target.files)} />
          </div>

          {status && (
            <div className={`text-sm text-center ${status.type === 'error' ? 'text-red-400' : status.type === 'success' ? 'text-[#4ecca3]' : 'text-gray-400'}`}>
              {status.message}
            </div>
          )}

          <button
            onClick={isReady ? handleStart : undefined}
            aria-disabled={!isReady}
            className={`w-full py-5 rounded-xl font-bold text-lg transition-opacity ${isReady ? 'bg-[#4ecca3] text-[#1a1a2e] cursor-pointer' : 'bg-[#4ecca3] text-[#1a1a2e] opacity-40 cursor-not-allowed'}`}
          >
            Start Reviewing Products →
          </button>

          <p className="text-center text-xs text-gray-500">
            CSV columns expected: <span className="text-gray-400">name, description, price, image_filename</span>
          </p>
        </div>
      </main>
    </div>
  )
}

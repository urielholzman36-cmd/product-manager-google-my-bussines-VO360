'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProductSession } from '@/context/ProductSessionContext'
import { parseFile } from '@/lib/parseCSV'
import type { Product } from '@/context/ProductSessionContext'
import type { GmbLocation } from '@/lib/gmbClient'

export default function UploadPage() {
  const router = useRouter()
  const { setProducts, setLocationId, setAccountId, setSelectedLocationName } = useProductSession()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [parsedProducts, setParsedProducts] = useState<Omit<Product, 'imageFile'>[]>([])
  const csvRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  // Business selector state
  const [locations, setLocations] = useState<GmbLocation[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<GmbLocation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const bothLoaded = parsedProducts.length > 0 && imageFiles.length > 0

  // Auto-fetch locations when both CSV and images are loaded
  useEffect(() => {
    if (!bothLoaded) return
    if (locations.length > 0 || locationsLoading) return
    fetchLocations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothLoaded])

  const fetchLocations = async () => {
    setLocationsLoading(true)
    setLocationsError(null)
    try {
      const res = await fetch('/api/gmb/locations')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to fetch locations')
      }
      const data = await res.json()
      setLocations(data.locations ?? [])
    } catch (err) {
      setLocationsError(err instanceof Error ? err.message : 'Failed to fetch locations')
    } finally {
      setLocationsLoading(false)
    }
  }

  const filteredLocations = locations.filter(loc =>
    loc.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.accountName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Derived — requires all three: CSV, images, and a selected business
  const isReady = parsedProducts.length > 0 && imageFiles.length > 0 && selectedLocation !== null

  const handleCSV = async (file: File) => {
    setCsvFile(file)
    setStatus({ message: 'Parsing file...', type: 'info' })
    const result = await parseFile(file)
    if (result.errors.length > 0) {
      setStatus({ message: result.errors[0], type: 'error' })
      return
    }
    setParsedProducts(result.products)
    setProductCount(result.products.length)
    setStatus({ message: `Found ${result.products.length} products`, type: 'success' })
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
  }

  const handleStart = () => {
    if (!selectedLocation) return
    const imageMap = new Map(imageFiles.map(f => [f.name, f]))
    const products: Product[] = parsedProducts.map(p => ({
      ...p,
      imageFile: imageMap.get(p.image_filename) ?? null,
    }))
    setProducts(products)
    setLocationId(selectedLocation.locationId)
    setAccountId(selectedLocation.accountId)
    setSelectedLocationName(selectedLocation.locationName)
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

          {/* Business Selector — shown once both CSV and images are loaded */}
          {bothLoaded && (
            <div className="bg-[#16213e] rounded-xl p-5 flex flex-col gap-3 border border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#4ecca3]">Select Business Location</h3>
                {selectedLocation && (
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">{selectedLocation.locationName}</span>
                )}
              </div>

              {locationsLoading && (
                <div className="text-center text-gray-400 py-4 text-sm">Loading your business locations...</div>
              )}

              {locationsError && !locationsLoading && (
                <div className="flex flex-col gap-2 items-center py-2">
                  <p className="text-red-400 text-sm text-center">{locationsError}</p>
                  <button
                    onClick={fetchLocations}
                    className="text-xs border border-[#4ecca3] text-[#4ecca3] px-3 py-1 rounded-full hover:bg-[#4ecca3] hover:text-[#1a1a2e] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!locationsLoading && !locationsError && locations.length > 0 && (
                <>
                  <input
                    type="text"
                    placeholder="Search by business or account name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-[#1a1a2e] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#4ecca3]"
                  />
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                    {filteredLocations.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-3">No results for &quot;{searchQuery}&quot;</p>
                    ) : (
                      filteredLocations.map(loc => (
                        <button
                          key={`${loc.accountId}-${loc.locationId}`}
                          onClick={() => setSelectedLocation(loc)}
                          className={`text-left px-3 py-2 rounded-lg transition-colors ${
                            selectedLocation?.locationId === loc.locationId && selectedLocation?.accountId === loc.accountId
                              ? 'bg-[#4ecca3] text-[#1a1a2e]'
                              : 'hover:bg-[#0f3460] text-white'
                          }`}
                        >
                          <div className="font-medium text-sm">{loc.locationName}</div>
                          <div className={`text-xs mt-0.5 ${
                            selectedLocation?.locationId === loc.locationId && selectedLocation?.accountId === loc.accountId
                              ? 'text-[#1a1a2e] opacity-70'
                              : 'text-gray-400'
                          }`}>{loc.accountName}</div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}

              {!locationsLoading && !locationsError && locations.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-3">No business locations found. Make sure you are connected with Google.</p>
              )}
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

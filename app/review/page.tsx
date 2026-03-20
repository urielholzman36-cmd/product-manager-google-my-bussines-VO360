'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProductSession, Product } from '@/context/ProductSessionContext'

type DescriptionState = 'loading' | 'ready' | 'error'

export default function ReviewPage() {
  const router = useRouter()
  const { products, addResult, approvedCount, skippedCount, reset, locationId, accountId } = useProductSession()
  const [index, setIndex] = useState(0)
  const [aiDescription, setAiDescription] = useState('')
  const [descState, setDescState] = useState<DescriptionState>('loading')
  const [activeTab, setActiveTab] = useState<'original' | 'ai'>('ai')
  const [editedDescription, setEditedDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const product = products[index]

  useEffect(() => {
    if (products.length === 0) { router.push('/'); return }
    generateDescription()
  }, [index, products])

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const generateDescription = async () => {
    if (!product) return
    setDescState('loading')
    setAiDescription('')
    setIsEditing(false)
    try {
      const imageBase64 = product.imageFile ? await toBase64(product.imageFile) : null
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: product.name, imageBase64 }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiDescription(data.description)
      setEditedDescription(data.description)
      setDescState('ready')
    } catch {
      setDescState('error')
    }
  }

  const getFinalDescription = () => isEditing ? editedDescription : (activeTab === 'ai' ? aiDescription : product.description)

  const handleApprove = async () => {
    const finalDescription = getFinalDescription()
    addResult({ product, approved: true, finalDescription })

    try {
      const imageBase64 = product.imageFile ? await toBase64(product.imageFile) : null
      await fetch('/api/gmb/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: { ...product, description: finalDescription },
          imageBase64,
          accountId,
          locationId,
        }),
      })
    } catch { /* error shown in future enhancement */ }

    advance()
  }

  const handleSkip = () => {
    addResult({ product, approved: false, finalDescription: product.description })
    advance()
  }

  const advance = () => {
    if (index + 1 >= products.length) { router.push('/summary'); return }
    setIndex(i => i + 1)
    setActiveTab('ai')
  }

  if (!product) return null

  const progress = Math.round(((index) / products.length) * 100)
  const imageUrl = product.imageFile ? URL.createObjectURL(product.imageFile) : null

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-3 flex justify-between items-center">
        <h1 className="text-[#4ecca3] font-bold">GMB Product Uploader</h1>
        <div className="flex gap-6 text-sm">
          <span>Product <b>{index + 1}</b> of <b>{products.length}</b></span>
          <span className="text-[#4ecca3]">&#10003; {approvedCount} approved</span>
          <span className="text-gray-400">&#8212; {skippedCount} skipped</span>
        </div>
      </header>

      <div className="h-1.5 bg-[#16213e]">
        <div className="h-1.5 bg-[#4ecca3] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-80 bg-[#16213e] flex flex-col items-center justify-center p-8 gap-6 border-r border-gray-800 flex-shrink-0">
          <div className="w-full aspect-square bg-[#1a1a2e] rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden">
            {imageUrl
              ? <img src={imageUrl} alt={product.name} className="w-full h-full object-cover rounded-2xl" />
              : <div className="text-center text-gray-500"><div className="text-5xl">&#128444;&#65039;</div><div className="text-xs mt-2">{product.image_filename || 'No image'}</div></div>
            }
          </div>
          <div className="w-full bg-[#0f3460] rounded-xl p-4 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Price</div>
            <div className="text-2xl font-bold text-[#4ecca3]">{product.price ? `$${product.price}` : 'Price not set'}</div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Product Name</div>
              <h2 className="text-3xl font-bold">{product.name}</h2>
            </div>

            <div>
              <div className="flex mb-3">
                <button onClick={() => setActiveTab('original')}
                  className={`px-4 py-2 text-sm font-bold rounded-l-lg ${activeTab === 'original' ? 'bg-[#e94560] text-white' : 'bg-[#0f3460] text-[#4ecca3]'}`}>
                  Original
                </button>
                <button onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 text-sm font-bold rounded-r-lg ${activeTab === 'ai' ? 'bg-[#e94560] text-white' : 'bg-[#0f3460] text-[#4ecca3]'}`}>
                  AI Improved
                </button>
              </div>
              <div className="bg-[#16213e] rounded-xl p-4 text-gray-300 text-sm leading-relaxed border border-gray-800">
                {activeTab === 'original' ? (product.description || <span className="text-gray-500 italic">No description provided</span>) : (
                  descState === 'loading' ? <span className="text-gray-500 animate-pulse">Generating description...</span>
                  : descState === 'error' ? <span className="text-red-400">Could not generate description. You can still use the original or type one manually.</span>
                  : aiDescription
                )}
              </div>
            </div>

            {descState === 'ready' && (
              <div className="bg-[#0a1628] border border-[#4ecca3] rounded-xl p-5">
                <div className="text-[#4ecca3] text-xs font-bold mb-3">AI-Generated Description</div>
                {isEditing
                  ? <textarea
                      className="w-full bg-[#16213e] text-white text-sm rounded-lg p-3 border border-gray-700 resize-none"
                      rows={4}
                      value={editedDescription}
                      onChange={e => setEditedDescription(e.target.value)}
                    />
                  : <p className="text-gray-200 text-sm leading-relaxed">{aiDescription}</p>
                }
                <div className="flex gap-3 mt-3">
                  <button onClick={() => { setActiveTab('ai'); setIsEditing(false) }} className="text-xs px-3 py-1.5 bg-[#16213e] border border-[#4ecca3] text-[#4ecca3] rounded-lg">Use this</button>
                  <button onClick={generateDescription} className="text-xs px-3 py-1.5 bg-[#16213e] border border-gray-700 text-gray-400 rounded-lg">Regenerate</button>
                  <button onClick={() => setIsEditing(e => !e)} className="text-xs px-3 py-1.5 bg-[#16213e] border border-gray-700 text-gray-400 rounded-lg">{isEditing ? 'Done editing' : 'Edit manually'}</button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#16213e] border-t border-gray-800 flex gap-4">
            <button onClick={handleApprove}
              className="flex-[3] bg-[#4ecca3] text-[#1a1a2e] font-bold text-lg py-5 rounded-xl hover:opacity-90 transition-opacity">
              &#10003; Approve &amp; Upload to Google My Business
            </button>
            <button onClick={handleSkip}
              className="flex-1 bg-[#1a1a2e] text-gray-400 py-5 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors">
              Skip
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'
import { useProductSession } from '@/context/ProductSessionContext'
import { useRouter } from 'next/navigation'

export default function SummaryPage() {
  const { approvedCount, skippedCount, locationId, reset } = useProductSession()
  const router = useRouter()

  const handleUploadMore = () => {
    reset()
    router.push('/')
  }

  const gmbUrl = locationId
    ? `https://business.google.com/dashboard/l/${locationId}`
    : 'https://business.google.com'

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-4">
        <h1 className="text-[#4ecca3] font-bold text-xl">GMB Product Uploader</h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-10">
        <div className="text-center flex flex-col gap-8 max-w-md w-full">
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold">Upload Complete</h2>
            <p className="text-gray-400 mt-2">Here's a summary of what happened</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#16213e] rounded-xl p-6">
              <div className="text-4xl font-bold text-[#4ecca3]">{approvedCount}</div>
              <div className="text-gray-400 mt-1">Uploaded</div>
            </div>
            <div className="bg-[#16213e] rounded-xl p-6">
              <div className="text-4xl font-bold text-gray-400">{skippedCount}</div>
              <div className="text-gray-400 mt-1">Skipped</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={gmbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-xl border border-[#4ecca3] text-[#4ecca3] text-center font-bold hover:bg-[#4ecca3] hover:text-[#1a1a2e] transition-colors"
            >
              View My GMB Listing →
            </a>
            <button
              onClick={handleUploadMore}
              className="w-full py-4 rounded-xl bg-[#16213e] text-gray-400 border border-gray-700 hover:border-gray-500 transition-colors"
            >
              Upload More Products
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

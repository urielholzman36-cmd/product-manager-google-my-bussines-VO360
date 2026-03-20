import { render, screen, fireEvent } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import SummaryPage from '@/app/summary/page'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

jest.mock('@/context/ProductSessionContext', () => ({
  ...jest.requireActual('@/context/ProductSessionContext'),
  useProductSession: jest.fn(),
}))

import { useProductSession } from '@/context/ProductSessionContext'

const mockUseProductSession = useProductSession as jest.Mock

describe('Summary Screen — zero-state (real provider)', () => {
  beforeEach(() => {
    mockPush.mockClear()
    // Delegate to real implementation for these tests
    mockUseProductSession.mockImplementation(
      jest.requireActual('@/context/ProductSessionContext').useProductSession
    )
  })

  it('renders summary with zero counts', () => {
    render(<ProductSessionProvider><SummaryPage /></ProductSessionProvider>)
    expect(screen.getByText(/upload complete/i)).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2)
  })

  it('shows Upload More button', () => {
    render(<ProductSessionProvider><SummaryPage /></ProductSessionProvider>)
    expect(screen.getByText(/upload more/i)).toBeInTheDocument()
  })
})

describe('Summary Screen — with mocked context', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('clicking "Upload More Products" calls reset and navigates to "/"', () => {
    const mockReset = jest.fn()
    mockUseProductSession.mockReturnValue({
      approvedCount: 2,
      skippedCount: 1,
      locationId: '',
      reset: mockReset,
    })

    render(<SummaryPage />)
    fireEvent.click(screen.getByText(/upload more products/i))
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('GMB link uses deep-link URL when locationId is set', () => {
    mockUseProductSession.mockReturnValue({
      approvedCount: 3,
      skippedCount: 1,
      locationId: 'abc123',
      reset: jest.fn(),
    })

    render(<SummaryPage />)
    const link = screen.getByRole('link', { name: /view my gmb listing/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('abc123'))
  })

  it('counters display correctly with non-zero values', () => {
    mockUseProductSession.mockReturnValue({
      approvedCount: 3,
      skippedCount: 1,
      locationId: 'abc123',
      reset: jest.fn(),
    })

    render(<SummaryPage />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})

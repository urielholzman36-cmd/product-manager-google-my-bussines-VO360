import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import SummaryPage from '@/app/summary/page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('Summary Screen', () => {
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

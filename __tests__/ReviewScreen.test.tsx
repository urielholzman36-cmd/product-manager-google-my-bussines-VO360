import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import ReviewPage from '@/app/review/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ description: 'AI description' }) })
) as jest.Mock

describe('Review Screen', () => {
  it('redirects to / when no products in context', () => {
    const push = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push })
    render(<ProductSessionProvider><ReviewPage /></ProductSessionProvider>)
    expect(push).toHaveBeenCalledWith('/')
  })
})

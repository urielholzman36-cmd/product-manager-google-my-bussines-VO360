import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import UploadPage from '@/app/page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const renderPage = () =>
  render(<ProductSessionProvider><UploadPage /></ProductSessionProvider>)

describe('Upload Screen', () => {
  it('renders upload screen with title', () => {
    renderPage()
    expect(screen.getByText('Upload Your Products')).toBeInTheDocument()
  })

  it('shows Start Reviewing button as disabled initially', () => {
    renderPage()
    const btn = screen.getByText(/Start Reviewing/i)
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows CSV format hint', () => {
    renderPage()
    expect(screen.getByText(/name.*description.*price.*image_filename/i)).toBeInTheDocument()
  })
})

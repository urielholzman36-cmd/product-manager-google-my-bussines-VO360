import { render, screen, act } from '@testing-library/react'
import { ProductSessionProvider, useProductSession } from '@/context/ProductSessionContext'

const TestConsumer = () => {
  const { products, setProducts, approvedCount, skippedCount } = useProductSession()
  return (
    <div>
      <span data-testid="count">{products.length}</span>
      <span data-testid="approved">{approvedCount}</span>
      <span data-testid="skipped">{skippedCount}</span>
      <button onClick={() => setProducts([{ name: 'Test', description: '', price: '9.99', image_filename: 'test.jpg', imageFile: null }])}>
        Add
      </button>
    </div>
  )
}

describe('ProductSessionContext', () => {
  it('provides initial empty state', () => {
    render(<ProductSessionProvider><TestConsumer /></ProductSessionProvider>)
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('approved').textContent).toBe('0')
    expect(screen.getByTestId('skipped').textContent).toBe('0')
  })

  it('updates products when setProducts is called', async () => {
    render(<ProductSessionProvider><TestConsumer /></ProductSessionProvider>)
    await act(async () => { screen.getByText('Add').click() })
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})

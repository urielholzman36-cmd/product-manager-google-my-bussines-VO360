import { parseFile, ParseResult } from '@/lib/parseCSV'

const makeCSV = (rows: string) =>
  new File([`name,description,price,image_filename\n${rows}`], 'products.csv', { type: 'text/csv' })

describe('parseFile', () => {
  it('parses valid CSV with all columns', async () => {
    const file = makeCSV('Wallet,Nice wallet,49.99,wallet.jpg')
    const result = await parseFile(file)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Wallet')
    expect(result.products[0].price).toBe('49.99')
    expect(result.errors).toHaveLength(0)
  })

  it('returns error if required column is missing', async () => {
    const file = new File(['name,description,price\nWallet,desc,9.99'], 'p.csv', { type: 'text/csv' })
    const result = await parseFile(file)
    expect(result.errors).toContain('Missing required columns: image_filename')
    expect(result.products).toHaveLength(0)
  })

  it('marks row with missing price as warning', async () => {
    const file = makeCSV('Wallet,desc,,wallet.jpg')
    const result = await parseFile(file)
    expect(result.products[0].price).toBe('')
    expect(result.warnings).toContain('Row 1: price is missing or invalid')
  })

  it('marks row with non-numeric price as warning', async () => {
    const file = makeCSV('Wallet,desc,abc,wallet.jpg')
    const result = await parseFile(file)
    expect(result.warnings).toContain('Row 1: price is missing or invalid')
    expect(result.products[0].price).toBe('')
  })
})

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Product } from '@/context/ProductSessionContext'

export interface ParseResult {
  products: Omit<Product, 'imageFile'>[]
  errors: string[]
  warnings: string[]
}

const REQUIRED_COLUMNS = ['name', 'description', 'price', 'image_filename']

function validatePrice(val: string): string {
  const num = parseFloat(val)
  return isNaN(num) || val.trim() === '' ? '' : val.trim()
}

function processRows(rows: Record<string, string>[]): ParseResult {
  const products: Omit<Product, 'imageFile'>[] = []
  const warnings: string[] = []

  rows.forEach((row, i) => {
    const price = validatePrice(row.price ?? '')
    if (!price && (row.price ?? '').trim() !== '') {
      warnings.push(`Row ${i + 1}: price is missing or invalid`)
    } else if ((row.price ?? '').trim() === '') {
      warnings.push(`Row ${i + 1}: price is missing or invalid`)
    }
    products.push({
      name: (row.name ?? '').trim(),
      description: (row.description ?? '').trim(),
      price,
      image_filename: (row.image_filename ?? '').trim(),
    })
  })

  return { products, errors: [], warnings }
}

async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? []
        const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
        if (missing.length > 0) {
          resolve({ products: [], errors: [`Missing required columns: ${missing.join(', ')}`], warnings: [] })
          return
        }
        resolve(processRows(result.data as Record<string, string>[]))
      },
    })
  })
}

async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  if (rows.length === 0) return { products: [], errors: ['Excel file is empty'], warnings: [] }
  const cols = Object.keys(rows[0])
  const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
  if (missing.length > 0) {
    return { products: [], errors: [`Missing required columns: ${missing.join(', ')}`], warnings: [] }
  }
  return processRows(rows)
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCSV(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file)
  return { products: [], errors: ['Unsupported file type. Use CSV or Excel (.xlsx, .xls)'], warnings: [] }
}

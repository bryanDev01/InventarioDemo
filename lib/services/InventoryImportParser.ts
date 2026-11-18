import mammoth from 'mammoth'
import readXlsxFile from 'read-excel-file/node'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { recognizedInventoryImportHeaders } from '@/lib/inventoryImport'
import type { InventoryImportFormat, ParsedInventoryFile } from '@/types/inventoryImport'

const MAX_ROWS = 2000
const MAX_COLUMNS = 60
const MAX_PDF_PAGES = 100
const HEADER_SEARCH_ROWS = 15
const require = createRequire(`${process.cwd()}/package.json`)

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
}

interface PositionedText extends PdfTextItem {
  x: number
  y: number
}

interface PdfTextRow {
  y: number
  items: PositionedText[]
}

interface PdfCell {
  x: number
  endX: number
  text: string
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

const isEmptyRow = (row: string[]): boolean => row.every((cell) => cell.trim() === '')

const normalizeMatrix = (
  matrix: string[][],
  format: InventoryImportFormat,
  sheetName: string | null,
): ParsedInventoryFile => {
  const nonEmptyRows = matrix
    .map((row) => row.slice(0, MAX_COLUMNS).map(cellText))
    .filter((row) => !isEmptyRow(row))
  if (nonEmptyRows.length < 2) throw new AppError(MESSAGES.inventoryImport.noRows, 400)

  const searchCount = Math.min(nonEmptyRows.length - 1, HEADER_SEARCH_ROWS)
  const headerIndex = Array.from({ length: searchCount }, (_, index) => index)
    .sort((left, right) => recognizedInventoryImportHeaders(nonEmptyRows[right]) - recognizedInventoryImportHeaders(nonEmptyRows[left]))[0] ?? 0
  const header = nonEmptyRows[headerIndex]
  const columnCount = Math.max(1, ...nonEmptyRows.map((row) => row.length))
  const headers = Array.from({ length: columnCount }, (_, index) => header[index]?.trim() || `Columna ${index + 1}`)
  const rows = nonEmptyRows.slice(headerIndex + 1)
    .map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''))
    .filter((row) => !isEmptyRow(row))

  if (rows.length === 0) throw new AppError(MESSAGES.inventoryImport.noRows, 400)
  if (rows.length > MAX_ROWS) throw new AppError(MESSAGES.inventoryImport.tooManyRows(MAX_ROWS), 400)

  return { format, sheetName, headers, rows }
}

const parseExcel = async (buffer: Buffer): Promise<ParsedInventoryFile> => {
  const sheets = await readXlsxFile(buffer)
  const selected = sheets.find((sheet) => sheet.data.some((row) => row.some((value) => cellText(value) !== '')))
  if (!selected) throw new AppError(MESSAGES.inventoryImport.noRows, 400)
  return normalizeMatrix(selected.data.map((row) => row.map(cellText)), 'xlsx', selected.sheet)
}

const decodeHtml = (value: string): string => value
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\s+/g, ' ')
  .trim()

const parseHtmlTables = (html: string): string[][][] => {
  const tables = Array.from(html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi))
  return tables.map((tableMatch) => {
    const tableContent = tableMatch[1] ?? ''
    return Array.from(tableContent.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
      .map((rowMatch) => Array.from((rowMatch[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))
        .map((cellMatch) => decodeHtml(cellMatch[1] ?? '')))
      .filter((row) => !isEmptyRow(row))
  })
}

const parseWord = async (buffer: Buffer): Promise<ParsedInventoryFile> => {
  const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false })
  const tables = parseHtmlTables(result.value)
  const selected = tables
    .filter((table) => table.length >= 2)
    .sort((left, right) => recognizedInventoryImportHeaders(right[0] ?? []) - recognizedInventoryImportHeaders(left[0] ?? []))[0]
  if (!selected) throw new AppError(MESSAGES.inventoryImport.noWordTable, 400)
  return normalizeMatrix(selected, 'docx', null)
}

const groupPdfRows = (items: PositionedText[]): PdfTextRow[] => {
  const ordered = items.slice().sort((left, right) => right.y - left.y || left.x - right.x)
  const rows: PdfTextRow[] = []

  for (const item of ordered) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row.y - item.y) <= 3) {
      row.items.push(item)
      row.y = row.items.reduce((sum, current) => sum + current.y, 0) / row.items.length
    } else {
      rows.push({ y: item.y, items: [item] })
    }
  }

  return rows.sort((left, right) => right.y - left.y)
}

const clusterPdfRow = (row: PdfTextRow): PdfCell[] => {
  const items = row.items.slice().sort((left, right) => left.x - right.x)
  const cells: PdfCell[] = []

  for (const item of items) {
    const current = cells[cells.length - 1]
    const gap = current ? item.x - current.endX : Number.POSITIVE_INFINITY
    if (current && gap <= 18) {
      current.text = `${current.text}${gap > 1 ? ' ' : ''}${item.str}`.trim()
      current.endX = item.x + item.width
    } else {
      cells.push({ x: item.x, endX: item.x + item.width, text: item.str.trim() })
    }
  }

  return cells.filter((cell) => cell.text !== '')
}

const pdfMatrix = async (buffer: Buffer): Promise<string[][]> => {
  GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
  const document = await loadingTask.promise
  try {
    if (document.numPages > MAX_PDF_PAGES) throw new AppError(MESSAGES.inventoryImport.tooManyPdfPages(MAX_PDF_PAGES), 400)
    const rows: PdfTextRow[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const items: PositionedText[] = content.items.flatMap((item) => {
        if (!('str' in item) || item.str.trim() === '') return []
        const textItem = item as PdfTextItem
        return [{ ...textItem, x: textItem.transform[4] ?? 0, y: textItem.transform[5] ?? 0 }]
      })
      rows.push(...groupPdfRows(items))
    }

    const cellRows = rows.map(clusterPdfRow).filter((row) => row.length > 0)
    const headerCandidates = cellRows
      .map((cells, index) => ({ cells, index, recognized: recognizedInventoryImportHeaders(cells.map((cell) => cell.text)) }))
      .filter((candidate) => candidate.recognized > 0)
      .sort((left, right) => right.recognized - left.recognized)
    const headerRow = headerCandidates[0]
    if (!headerRow) throw new AppError(MESSAGES.inventoryImport.noPdfTable, 400)

    const headerCells = headerRow.cells
    const headers = headerCells.map((cell) => cell.text)
    const rowsAfterHeader = cellRows.slice(headerRow.index + 1)
    const normalizedHeader = headers.join('|').toLowerCase()
    const matrix = rowsAfterHeader.flatMap((cells) => {
      const row = Array.from({ length: headers.length }, () => '')
      for (const cell of cells) {
        let column = 0
        for (let index = 1; index < headerCells.length; index += 1) {
          if (cell.x >= headerCells[index].x) column = index
        }
        row[column] = row[column] === '' ? cell.text : `${row[column]} ${cell.text}`
      }
      if (row.every((cell) => cell.trim() === '')) return []
      if (row.join('|').toLowerCase() === normalizedHeader) return []
      return [row]
    })
    return [headers, ...matrix]
  } finally {
    await loadingTask.destroy()
  }
}

const parsePdf = async (buffer: Buffer): Promise<ParsedInventoryFile> =>
  normalizeMatrix(await pdfMatrix(buffer), 'pdf', null)

export const parseInventoryFile = async (filename: string, buffer: Buffer): Promise<ParsedInventoryFile> => {
  const extension = filename.toLowerCase().split('.').pop()
  try {
    if (extension === 'xlsx') return await parseExcel(buffer)
    if (extension === 'pdf') return await parsePdf(buffer)
    if (extension === 'docx') return await parseWord(buffer)
  } catch (error) {
    if (error instanceof AppError) throw error
    console.error('Inventory import parse failed:', error)
    throw new AppError(MESSAGES.inventoryImport.parseFailed, 400)
  }
  throw new AppError(MESSAGES.inventoryImport.unsupportedFormat, 400)
}

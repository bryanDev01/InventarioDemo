import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { APP_NAME } from '@/lib/constants'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { SoldProductsReport } from '@/lib/services/ReportService'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_X = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const BOTTOM_LIMIT = 70

const COLUMNS = {
  code: { x: MARGIN_X, width: 85, align: 'left' as const },
  name: { x: MARGIN_X + 85, width: 175, align: 'left' as const },
  quantity: { x: MARGIN_X + 260, width: 55, align: 'right' as const },
  cup: { x: MARGIN_X + 315, width: 100, align: 'right' as const },
  usd: { x: MARGIN_X + 415, width: 100, align: 'right' as const },
}

interface Fonts {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
}

const wrapText = (text: string, font: Fonts['regular'], size: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current !== '') lines.push(current)
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word
    } else {
      let chunk = ''
      for (const character of word) {
        if (font.widthOfTextAtSize(chunk + character, size) > maxWidth && chunk !== '') {
          lines.push(chunk)
          chunk = character
        } else {
          chunk += character
        }
      }
      current = chunk
    }
  }
  if (current !== '') lines.push(current)
  return lines.length > 0 ? lines : ['']
}

export const buildReportPdf = async (report: SoldProductsReport): Promise<Uint8Array> => {
  const document = await PDFDocument.create()
  document.setTitle(report.title)
  document.setCreator(APP_NAME)
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const fonts: Fonts = { regular, bold }

  const black = rgb(0, 0, 0)
  const grey = rgb(0.45, 0.45, 0.45)
  const headerFill = rgb(0.93, 0.92, 0.88)

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - 60

  const drawHeader = (): void => {
    const titleWidth = bold.widthOfTextAtSize(report.title, 15)
    page.drawText(report.title, { x: (PAGE_WIDTH - titleWidth) / 2, y, size: 15, font: bold, color: black })
    y -= 20
    page.drawText(ReportServiceText.generated(report), { x: MARGIN_X, y, size: 9, font: regular, color: grey })
    y -= 13
    page.drawText(ReportServiceText.period(report), { x: MARGIN_X, y, size: 9, font: regular, color: grey })
    y -= 13
    page.drawText(ReportServiceText.warehouse(report), { x: MARGIN_X, y, size: 9, font: regular, color: grey })
    y -= 22
  }

  const drawTableHeader = (): void => {
    page.drawRectangle({ x: MARGIN_X, y: y - 4, width: CONTENT_WIDTH, height: 16, color: headerFill })
    const labels: [keyof typeof COLUMNS, string][] = [
      ['code', MESSAGES.reports.columns.code],
      ['name', MESSAGES.reports.columns.name],
      ['quantity', MESSAGES.reports.columns.quantity],
      ['cup', MESSAGES.reports.columns.columnsCUP],
      ['usd', MESSAGES.reports.columns.columnsUSD],
    ]
    for (const [key, label] of labels) {
      const column = COLUMNS[key]
      const size = 9
      const width = bold.widthOfTextAtSize(label, size)
      const x = column.align === 'right' ? column.x + column.width - width : column.x
      page.drawText(label, { x, y, size, font: bold, color: black })
    }
    y -= 12
  }

  drawHeader()
  drawTableHeader()

  const drawFooter = (): void => {
    page.drawText(`${APP_NAME_MARK}`, { x: MARGIN_X, y: 30, size: 8, font: regular, color: grey })
  }

  for (const row of report.rows) {
    const nameLines = wrapText(row.name, fonts.regular, 9, COLUMNS.name.width - 6)
    const rowHeight = Math.max(15, nameLines.length * 11 + 4)
    if (y - rowHeight < BOTTOM_LIMIT) {
      drawFooter()
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - 60
      drawHeader()
      drawTableHeader()
    }

    const values: [keyof typeof COLUMNS, string, boolean][] = [
      ['code', row.code, false],
      ['quantity', String(row.quantity), false],
      ['cup', formatCents(row.totalCupCents), false],
      ['usd', formatCents(row.totalUsdCents), false],
    ]
    for (const [key, value, boldValue] of values) {
      const column = COLUMNS[key]
      const size = 9
      const font = boldValue ? fonts.bold : fonts.regular
      const width = font.widthOfTextAtSize(value, size)
      const x = column.align === 'right' ? column.x + column.width - width : column.x
      page.drawText(value, { x, y, size, font, color: black })
    }
    nameLines.forEach((line, index) => {
      page.drawText(line, { x: COLUMNS.name.x, y: y - index * 11, size: 9, font: fonts.regular, color: black })
    })

    y -= rowHeight
    page.drawLine({
      start: { x: MARGIN_X, y: y + 6 },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: y + 6 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
  }

  y -= 10
  const totals: [string, string][] = [
    [MESSAGES.reports.totalProducts, String(report.productsSold)],
    [MESSAGES.reports.totalIncomeCup, formatCents(report.incomeCupCents)],
    [MESSAGES.reports.totalIncomeUsd, formatCents(report.incomeUsdCents)],
  ]
  for (const [label, value] of totals) {
    const width = bold.widthOfTextAtSize(value, 10)
    page.drawText(label, { x: MARGIN_X, y, size: 10, font: bold, color: black })
    page.drawText(value, { x: MARGIN_X + CONTENT_WIDTH - width, y, size: 10, font: bold, color: black })
    y -= 15
  }

  drawFooter()

  return document.save()
}

const APP_NAME_MARK = APP_NAME

const ReportServiceText = {
  generated: (report: SoldProductsReport): string => `${MESSAGES.reports.generated}: ${report.generatedAtText}`,
  period: (report: SoldProductsReport): string => `${MESSAGES.reports.period}: ${report.period.label}`,
  warehouse: (report: SoldProductsReport): string => `${MESSAGES.reports.warehouse}: ${report.warehouse.label}`,
}

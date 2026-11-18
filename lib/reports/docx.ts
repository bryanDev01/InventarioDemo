import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { SoldProductsReport } from '@/lib/services/ReportService'

const CELL_MARGIN = 60

const headerCell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell =>
  new TableCell({
    margins: { top: CELL_MARGIN, bottom: CELL_MARGIN, left: CELL_MARGIN, right: CELL_MARGIN },
    shading: { fill: 'EFEEE0' },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, size: 18 })],
      }),
    ],
  })

const bodyCell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell =>
  new TableCell({
    margins: { top: CELL_MARGIN, bottom: CELL_MARGIN, left: CELL_MARGIN, right: CELL_MARGIN },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 18 })],
      }),
    ],
  })

export const buildReportDocx = async (report: SoldProductsReport): Promise<Buffer> => {
  const rows = report.rows.map(
    (row) =>
      new TableRow({
        children: [
          bodyCell(row.code, AlignmentType.LEFT),
          bodyCell(row.name, AlignmentType.LEFT),
          bodyCell(String(row.quantity), AlignmentType.RIGHT),
          bodyCell(formatCents(row.totalCupCents), AlignmentType.RIGHT),
          bodyCell(formatCents(row.totalUsdCents), AlignmentType.RIGHT),
        ],
      })
  )

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell(MESSAGES.reports.columns.code, AlignmentType.LEFT),
          headerCell(MESSAGES.reports.columns.name, AlignmentType.LEFT),
          headerCell(MESSAGES.reports.columns.quantity, AlignmentType.RIGHT),
          headerCell(MESSAGES.reports.columns.columnsCUP, AlignmentType.RIGHT),
          headerCell(MESSAGES.reports.columns.columnsUSD, AlignmentType.RIGHT),
        ],
      }),
      ...rows,
    ],
  })

  const document = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: report.title, bold: true, size: 30 })],
          }),
          new Paragraph({ text: `${MESSAGES.reports.generated}: ${report.generatedAtText}` }),
          new Paragraph({ text: `${MESSAGES.reports.period}: ${report.period.label}` }),
          new Paragraph({ text: `${MESSAGES.reports.warehouse}: ${report.warehouse.label}` }),
          new Paragraph({ text: '' }),
          table,
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `${MESSAGES.reports.totalProducts}: ${report.productsSold}`, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `${MESSAGES.reports.totalIncomeCup}: ${formatCents(report.incomeCupCents)}`, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `${MESSAGES.reports.totalIncomeUsd}: ${formatCents(report.incomeUsdCents)}`, bold: true })],
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(document)
}

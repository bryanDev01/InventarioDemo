import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { ReportService } from '@/lib/services/ReportService'
import { buildReportDocx } from '@/lib/reports/docx'
import { buildReportPdf } from '@/lib/reports/pdf'
import type { ApiResponse } from '@/types/api'

const PDF_TYPE = 'application/pdf'
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function GET(request: Request): Promise<NextResponse<ApiResponse<never> | Uint8Array | Buffer>> {
  try {
    const actor = await requireUser()
    const params = new URL(request.url).searchParams
    const format = params.get('format') ?? 'pdf'
    const report = await ReportService.build(actor, {
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      warehouseId: params.get('warehouseId') ?? undefined,
    })
    ReportService.assertNotEmpty(report)

    const fileName = `reporte-productos-vendidos-${report.period.from}-a-${report.period.to}`

    if (format === 'word' || format === 'docx') {
      const buffer = await buildReportDocx(report)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': DOCX_TYPE,
          'Content-Disposition': `attachment; filename="${fileName}.docx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const bytes = await buildReportPdf(report)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': PDF_TYPE,
        'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

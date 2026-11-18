import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { AppError, toErrorResponse } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { ROLES } from '@/lib/constants'
import { parseInventoryFile } from '@/lib/services/InventoryImportParser'
import type { ApiResponse } from '@/types/api'
import type { ParsedInventoryFile } from '@/types/inventoryImport'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: Request): Promise<NextResponse<ApiResponse<ParsedInventoryFile>>> {
  try {
    await requireRole([ROLES.ADMIN])
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) throw new AppError(MESSAGES.inventoryImport.fileRequired, 400)
    if (file.size === 0) throw new AppError(MESSAGES.inventoryImport.fileRequired, 400)
    if (file.size > MAX_FILE_SIZE) throw new AppError(MESSAGES.inventoryImport.fileTooLarge, 413)

    const data = await parseInventoryFile(file.name, Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

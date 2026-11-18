'use client'

import { useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { createInventoryImportRows, getImportHeaderLabel, IMPORT_FIELD_LABELS, suggestInventoryImportMapping } from '@/lib/inventoryImport'
import { MESSAGES } from '@/lib/messages'
import type { InventoryImportField, InventoryImportMapping } from '@/lib/inventoryImport'
import type {
  InventoryImportPreview,
  InventoryImportResult,
  InventoryImportRow,
  ParsedInventoryFile,
} from '@/types/inventoryImport'

interface InventoryImportWizardProps {
  warehouseId: string
  onImported: (result: InventoryImportResult) => void
  onCancel: () => void
}

const F = MESSAGES.ui.inventory.import
const IMPORT_FIELDS: InventoryImportField[] = ['code', 'name', 'basePrice', 'stock']
const inputClass = 'w-full min-w-28 rounded-md border border-ivory-dark bg-ivory px-2 py-2 text-sm text-black focus:border-gold focus:outline-none'
const selectClass = 'w-full min-w-36 rounded-md border border-ivory-dark bg-ivory px-2 py-2 text-sm text-black focus:border-gold focus:outline-none'

export default function InventoryImportWizard({ warehouseId, onImported, onCancel }: InventoryImportWizardProps): ReactElement {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedInventoryFile | null>(null)
  const [mapping, setMapping] = useState<InventoryImportMapping>({ code: null, name: null, basePrice: null, stock: null })
  const [rows, setRows] = useState<InventoryImportRow[]>([])
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null)
  const [previewStale, setPreviewStale] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const readFile = async (): Promise<void> => {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const result = await apiRequest<ParsedInventoryFile>(
        `/api/warehouses/${encodeURIComponent(warehouseId)}/products/import/parse`,
        { method: 'POST', body: formData },
      )
      if (!result) throw new Error(MESSAGES.inventoryImport.parseFailed)
      setParsed(result)
      setMapping(suggestInventoryImportMapping(result.headers))
      setPreview(null)
      setPreviewStale(false)
      setRows([])
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  const updateMapping = (field: InventoryImportField, value: string): void => {
    const column = value === '' ? null : Number(value)
    setMapping((current) => ({ ...current, [field]: column }))
    setPreviewStale(true)
  }

  const getMappedRows = (): InventoryImportRow[] =>
    createInventoryImportRows(parsed?.rows ?? [], mapping)

  const inspectRows = async (draft: InventoryImportRow[], showGeneralError = true): Promise<InventoryImportPreview | null> => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<InventoryImportPreview>(
        `/api/warehouses/${encodeURIComponent(warehouseId)}/products/import/preview`,
        { method: 'POST', body: JSON.stringify({ rows: draft }) },
      )
      if (!result) throw new Error(MESSAGES.inventoryImport.correctRows)
      setRows(draft)
      setPreview(result)
      setPreviewStale(false)
      if (showGeneralError && result.rows.some((row) => row.errors.length > 0)) setError(F.errors)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      return null
    } finally {
      setBusy(false)
    }
  }

  const reviewMappedRows = async (): Promise<void> => {
    if (!parsed || busy) return
    const mappedRows = getMappedRows()
    if (mappedRows.length === 0) {
      setError(MESSAGES.inventoryImport.noRows)
      return
    }
    await inspectRows(mappedRows)
  }

  const updateRow = (index: number, patch: Partial<InventoryImportRow>): void => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
    setPreviewStale(true)
    setError(null)
  }

  const submitImport = async (): Promise<void> => {
    if (busy || rows.length === 0) return
    const checked = await inspectRows(rows)
    if (!checked || checked.rows.some((row) => row.errors.length > 0)) return

    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<InventoryImportResult>(
        `/api/warehouses/${encodeURIComponent(warehouseId)}/products/import`,
        { method: 'POST', body: JSON.stringify({ rows }) },
      )
      if (!result) throw new Error(MESSAGES.inventoryImport.importFailed)
      onImported(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setFile(event.target.files?.[0] ?? null)
    setParsed(null)
    setPreview(null)
    setRows([])
    setError(null)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 text-black">
      <p className="text-sm text-black/75">{F.help}</p>
      <p className="text-xs text-black/60">{F.formats} {F.maxFile}</p>

      <div className="flex flex-col gap-3 rounded-lg border border-ivory-dark bg-ivory p-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-black/75">
          {F.chooseFile}
          <input type="file" accept=".xlsx,.pdf,.docx" onChange={handleFileChange} className="w-full min-w-0 rounded-md border border-ivory-dark bg-white px-3 py-2 text-sm text-black" />
        </label>
        <button type="button" onClick={() => void readFile()} disabled={!file || busy} className="min-h-11 w-full shrink-0 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
          {busy && !parsed ? F.parsing : F.parse}
        </button>
      </div>

      {parsed && (
        <>
          <p className="text-xs text-black/60">
            {file?.name} · {parsed.rows.length} filas{parsed.sheetName ? ` · ${parsed.sheetName}` : ''}
          </p>

          <section className="flex flex-col gap-3 rounded-lg border border-ivory-dark bg-ivory p-3">
            <div>
              <h3 className="font-semibold">{F.mappingTitle}</h3>
              <p className="text-xs text-black/65">{F.mappingHelp}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <label key={field} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-black/75">
                  {IMPORT_FIELD_LABELS[field]}
                  <select value={mapping[field] === null ? '' : String(mapping[field])} onChange={(event) => updateMapping(field, event.target.value)} className={selectClass}>
                    <option value="">{F.notMapped}</option>
                    {parsed.headers.map((header, index) => (
                      <option key={`${index}-${header}`} value={String(index)}>{getImportHeaderLabel(parsed.headers, index)}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={() => void reviewMappedRows()} disabled={busy} className="min-h-11 w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-ivory hover:bg-black-soft disabled:opacity-50 sm:w-fit">
                {busy ? F.checking : F.preview}
              </button>
              {!preview && (
                <button type="button" onClick={onCancel} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark sm:w-fit">
                  {F.cancel}
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {preview && (
        <section className="flex min-w-0 flex-col gap-3">
          <div>
            <h3 className="font-semibold">{F.reviewTitle}</h3>
            <p className="text-xs text-black/65">{F.mappingHelp}</p>
          </div>
          <div className="max-h-[45vh] overflow-auto rounded-lg border border-ivory-dark bg-ivory">
            <table className="min-w-[1050px] text-left text-xs text-black">
              <thead className="sticky top-0 border-b border-ivory-dark bg-ivory-dark">
                <tr>
                  <th className="px-2 py-2">{F.sourceRow}</th>
                  <th className="px-2 py-2">{F.rowCode}</th>
                  <th className="px-2 py-2">{F.rowName}</th>
                  <th className="px-2 py-2">{F.rowPrice}</th>
                  <th className="px-2 py-2">{F.rowStock}</th>
                  <th className="px-2 py-2">{F.status}</th>
                  <th className="px-2 py-2">{F.stockAction}</th>
                  <th className="px-2 py-2">{F.priceAction}</th>
                  <th className="px-2 py-2">{F.nameAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const state = preview.rows[index]
                  const nameConflict = state?.nameConflict ?? false
                  const itemStatus = state?.existingInventory
                    ? state.existingInventory.isDeleted ? F.deletedMatch : F.matchInWarehouse
                    : state?.existingProduct ? F.matchOtherWarehouse : F.newProduct

                  return (
                    <tr key={`${row.sourceRow}-${index}`} className="border-b border-ivory-dark align-top last:border-0">
                      <td className="px-2 py-2 tabular-nums">{row.sourceRow}</td>
                      <td className="px-2 py-2">
                        <input value={row.code} onChange={(event) => updateRow(index, { code: event.target.value.toUpperCase() })} className={inputClass} aria-label={`${F.rowCode} ${row.sourceRow}`} />
                        {!row.code && <p className="mt-1 text-[11px] text-black/60">{F.generatedCode}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} className={inputClass} aria-label={`${F.rowName} ${row.sourceRow}`} />
                        {nameConflict && state?.existingProduct && (
                          <p className="mt-1 max-w-64 text-[11px] text-amber-800">
                            {F.nameConflictWarning(row.code, state.existingProduct.name, row.name)}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.basePrice} onChange={(event) => updateRow(index, { basePrice: event.target.value })} inputMode="decimal" className={inputClass} aria-label={`${F.rowPrice} ${row.sourceRow}`} />
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.stock} onChange={(event) => updateRow(index, { stock: event.target.value })} inputMode="numeric" className={inputClass} aria-label={`${F.rowStock} ${row.sourceRow}`} />
                      </td>
                      <td className="max-w-48 px-2 py-2">
                        <p>{itemStatus}</p>
                        {state && state.errors.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-red-700">{state.errors.map((message) => <li key={message}>{message}</li>)}</ul>
                        )}
                        {state?.duplicateCodeInFile && <p className="mt-1 text-red-700">{F.duplicateFile}</p>}
                        {row.nameMode === 'new_code' && <p className="mt-1 text-black/60">{F.generatedCode}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <select value={row.stockMode} onChange={(event) => {
                          const value = event.target.value
                          if (value === 'replace' || value === 'add' || value === 'skip') updateRow(index, { stockMode: value })
                        }} className={selectClass} aria-label={`${F.stockAction} ${row.sourceRow}`}>
                          <option value="replace">{F.replaceStock}</option>
                          <option value="add">{F.addStock}</option>
                          <option value="skip">{F.skipRow}</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {state?.existingInventory ? (
                          <select value={row.priceMode} onChange={(event) => updateRow(index, { priceMode: event.target.value === 'keep' ? 'keep' : 'import' })} className={selectClass} aria-label={`${F.priceAction} ${row.sourceRow}`}>
                            <option value="import">{F.importPrice}</option>
                            <option value="keep">{F.keepPrice}</option>
                          </select>
                        ) : F.importPrice}
                      </td>
                      <td className="px-2 py-2">
                        {state?.existingProduct && nameConflict ? (
                          <select value={row.nameMode} onChange={(event) => {
                            const value = event.target.value
                            if (value === 'keep' || value === 'rename' || value === 'new_code') updateRow(index, { nameMode: value })
                          }} className={selectClass} aria-label={`${F.nameAction} ${row.sourceRow}`}>
                            <option value="keep">{F.keepName}</option>
                            <option value="rename">{F.renameAll}</option>
                            <option value="new_code">{F.useNewCode}</option>
                          </select>
                        ) : state?.existingProduct ? F.keepName : F.notApplicable}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
              {F.cancel}
            </button>
            <button type="button" onClick={() => void inspectRows(rows)} disabled={busy || !previewStale} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
              {busy ? F.checking : F.preview}
            </button>
            <button type="button" onClick={() => void submitImport()} disabled={busy || previewStale || preview.rows.some((row) => row.errors.length > 0)} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
              {busy ? F.importing : F.confirm}
            </button>
          </div>
        </section>
      )}

      {!preview && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!parsed && (
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark sm:w-auto">
            {F.cancel}
          </button>
        </div>
      )}
    </div>
  )
}

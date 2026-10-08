import type { DemoData } from './data'

export const selectClass =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60'

export const label = (s: string): string => s.replace(/_/g, ' ')

export function driverName(data: DemoData, id?: string): string {
  return data.drivers.find((d) => d.id === id)?.name ?? 'Unassigned'
}

export function vehicleLabel(data: DemoData, id?: string): string {
  const v = data.vehicles.find((x) => x.id === id)
  return v ? `${v.label.replace(/^\d{4} /, '')} (${v.plate})` : 'Unassigned'
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

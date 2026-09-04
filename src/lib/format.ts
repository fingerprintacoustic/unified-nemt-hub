export const formatDate = (

  value: Date | string | number | undefined | null,
): string => {
  if (value === undefined || value === null) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTime = (
  value: Date | string | number | undefined | null,
): string => {
  if (value === undefined || value === null) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const formatRole = (role: string): string => {
  switch (role) {
    case 'ADMIN':
      return 'Admin'
    case 'MANAGER':
      return 'Manager'
    case 'DISPATCHER':
      return 'Dispatcher'
    case 'DRIVER':
      return 'Driver'
    default:
      return role
  }
}

export const initialsFrom = (name: string): string => {
  const parts = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
  return (
    parts.map((part) => part[0]?.toUpperCase()).join('') ||
    '?'
  )
}
'use strict'

/**
 * Pure rules for who may invite whom, kept separate from Firebase so they are
 * easy to test. The owner's rule: an ADMIN may invite any role; a MANAGER may
 * invite DISPATCHER and DRIVER only; nobody else may invite anyone.
 */
const INVITABLE_ROLES = {
  ADMIN: ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER'],
  MANAGER: ['DISPATCHER', 'DRIVER'],
}

const ALL_ROLES = ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']

function canInvite(callerRole, targetRole) {
  return (INVITABLE_ROLES[callerRole] ?? []).includes(targetRole)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Returns { value } with cleaned input, or { error } describing the first problem. */
function validateInvite(data) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '')
  const email = str(data?.email).toLowerCase()
  const firstName = str(data?.firstName)
  const lastName = str(data?.lastName)
  const role = str(data?.role)

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }
  if (!firstName || !lastName) return { error: 'Enter a first and last name.' }
  if (firstName.length > 80 || lastName.length > 80) return { error: 'Names must be under 80 characters.' }
  if (!ALL_ROLES.includes(role)) return { error: 'Choose a valid role.' }

  const value = { email, firstName, lastName, role }

  if (role === 'DRIVER') {
    const phone = str(data?.phone)
    const licenseNumber = str(data?.licenseNumber)
    const licenseState = str(data?.licenseState).toUpperCase()
    const licenseExpiry = str(data?.licenseExpiry)
    if (!phone) return { error: 'Enter the driver’s phone number.' }
    if (!licenseNumber) return { error: 'Enter the driver’s license number.' }
    if (!/^[A-Z]{2}$/.test(licenseState)) return { error: 'Enter the license state as two letters, for example IL.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry) || Number.isNaN(Date.parse(`${licenseExpiry}T00:00:00Z`))) {
      return { error: 'Enter a valid license expiry date.' }
    }
    Object.assign(value, { phone, licenseNumber, licenseState, licenseExpiry })
  }

  return { value }
}

module.exports = { canInvite, validateInvite, INVITABLE_ROLES }

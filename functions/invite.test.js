'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { canInvite, validateInvite } = require('./invite')

test('admin can invite every role', () => {
  for (const r of ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']) assert.equal(canInvite('ADMIN', r), true)
})

test('manager can invite only dispatchers and drivers', () => {
  assert.equal(canInvite('MANAGER', 'DISPATCHER'), true)
  assert.equal(canInvite('MANAGER', 'DRIVER'), true)
  assert.equal(canInvite('MANAGER', 'MANAGER'), false)
  assert.equal(canInvite('MANAGER', 'ADMIN'), false)
})

test('dispatchers, drivers and unknown roles cannot invite anyone', () => {
  for (const caller of ['DISPATCHER', 'DRIVER', undefined, 'OWNER']) {
    for (const r of ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']) assert.equal(canInvite(caller, r), false)
  }
})

test('valid non-driver invite is cleaned up', () => {
  const { value, error } = validateInvite({ email: '  Sam@Acme.COM ', firstName: ' Sam', lastName: 'Rivera ', role: 'DISPATCHER' })
  assert.equal(error, undefined)
  assert.deepEqual(value, { email: 'sam@acme.com', firstName: 'Sam', lastName: 'Rivera', role: 'DISPATCHER' })
})

test('rejects bad email, missing names and unknown role', () => {
  assert.ok(validateInvite({ email: 'nope', firstName: 'A', lastName: 'B', role: 'DISPATCHER' }).error)
  assert.ok(validateInvite({ email: 'a@b.co', firstName: '', lastName: 'B', role: 'DISPATCHER' }).error)
  assert.ok(validateInvite({ email: 'a@b.co', firstName: 'A', lastName: 'B', role: 'OWNER' }).error)
  assert.ok(validateInvite(undefined).error)
})

test('driver invites need phone and license details', () => {
  const base = { email: 'd@b.co', firstName: 'D', lastName: 'R', role: 'DRIVER' }
  assert.ok(validateInvite(base).error)
  assert.ok(validateInvite({ ...base, phone: '555', licenseNumber: 'X1', licenseState: 'Illinois', licenseExpiry: '2028-01-01' }).error)
  assert.ok(validateInvite({ ...base, phone: '555', licenseNumber: 'X1', licenseState: 'il', licenseExpiry: '01/01/2028' }).error)
  const ok = validateInvite({ ...base, phone: '555', licenseNumber: 'X1', licenseState: 'il', licenseExpiry: '2028-01-01' })
  assert.equal(ok.error, undefined)
  assert.equal(ok.value.licenseState, 'IL')
})

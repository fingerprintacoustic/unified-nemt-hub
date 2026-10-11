'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { canInvite, validateInvite } = require('./invite')

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 5 })

/**
 * Creates a new login (Firebase Auth user + users/{uid} document) inside the
 * CALLER's own organization. The organization is never taken from the request.
 * For the DRIVER role it also creates the linked drivers/{id} roster record.
 *
 * The invited person sets their own password via a password-setup email, which
 * the web app triggers right after this returns (Firebase sends it).
 */
exports.inviteUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

  const db = getFirestore()
  const auth = getAuth()

  const callerSnap = await db.collection('users').doc(request.auth.uid).get()
  const caller = callerSnap.data()
  if (!callerSnap.exists || caller.status !== 'ACTIVE') {
    throw new HttpsError('permission-denied', 'Your account is not active.')
  }

  const parsed = validateInvite(request.data)
  if (parsed.error) throw new HttpsError('invalid-argument', parsed.error)
  const invite = parsed.value

  if (!canInvite(caller.role, invite.role)) {
    throw new HttpsError('permission-denied', 'Your role is not allowed to invite that kind of user.')
  }

  try {
    await auth.getUserByEmail(invite.email)
    throw new HttpsError('already-exists', 'A login with that email already exists.')
  } catch (error) {
    if (error instanceof HttpsError) throw error
    if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Could not check that email.')
  }

  let uid
  try {
    const created = await auth.createUser({
      email: invite.email,
      displayName: `${invite.firstName} ${invite.lastName}`,
      emailVerified: false,
    })
    uid = created.uid

    const organizationId = caller.organizationId
    const now = FieldValue.serverTimestamp()
    const batch = db.batch()

    batch.set(db.collection('users').doc(uid), {
      uid,
      organizationId,
      role: invite.role,
      status: 'ACTIVE',
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      createdAt: now,
      updatedAt: now,
    })

    if (invite.role === 'DRIVER') {
      const driverRef = db.collection('drivers').doc()
      batch.set(driverRef, {
        driverId: driverRef.id,
        organizationId,
        userId: uid,
        firstName: invite.firstName,
        lastName: invite.lastName,
        email: invite.email,
        phone: invite.phone,
        licenseNumber: invite.licenseNumber,
        licenseState: invite.licenseState,
        licenseExpiry: Timestamp.fromDate(new Date(`${invite.licenseExpiry}T00:00:00`)),
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      })
    }

    // Server-written audit entry, same shape as the app's own audit logs.
    batch.set(db.collection('auditLogs').doc(), {
      organizationId,
      action: 'user.invited',
      actorId: request.auth.uid,
      actorRole: caller.role,
      targetCollection: 'users',
      targetId: uid,
      details: { role: invite.role },
      createdAt: now,
    })

    await batch.commit()
    return { uid }
  } catch (error) {
    if (uid) await auth.deleteUser(uid).catch(() => {})
    if (error instanceof HttpsError) throw error
    console.error('inviteUser failed', error)
    throw new HttpsError('internal', 'Could not create that user. Nothing was saved.')
  }
})

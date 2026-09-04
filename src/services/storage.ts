import { deleteObject, getDownloadURL, ref, uploadBytesResumable, type UploadTask } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase'

export const MAX_INSPECTION_MEDIA_BYTES = 15 * 1024 * 1024 // 15 MB — mirrors storage.rules.

export type MediaKind = 'inspection' | 'driver'

export interface UploadResult {
  url: string
  storagePath: string
}

export function buildInspectionMediaPath(orgId: string, inspectionId: string, fileName: string): string {
  return `inspections/${orgId}/${inspectionId}/${sanitizeFileName(fileName)}`
}

export function buildDriverMediaPath(orgId: string, uid: string, kind: string, fileName: string): string {
  return `driver-pwa/${orgId}/${uid}/${kind}/${sanitizeFileName(fileName)}`
}

function sanitizeFileName(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot).toLowerCase() : '.jpg'
    return `${stem}.${ext}`.replace(/\.{2,}/g, '.');
}

/**
 * Uploads a file with progress tracking. Bucket ACLs and org-scoped paths are
 * enforced server-side by storage.rulesso the client only ever supplies an
 * org-scoped path it already knows..
 */
export function uploadMedia(
  orgId: string,
  scope: MediaKind,
  scopeId: string,
  kind: string,
  file: File,
  onProgress?: (percent: number) => void,
): UploadTask {
  if (file.size > MAX_INSPECTION_MEDIA_BYTES) {
     throw new Error('File exceeds the 15 MB media limit.')
   }
   const path =
     scope === 'inspection'
       ? buildInspectionMediaPath(orgId, scopeId, file.name)
       : buildDriverMediaPath(orgId, scopeId, kind, file.name)
   const task = uploadBytesResumable(ref(getFirebaseStorage(), path), file)
  task.on('state_changed', (snapshot) => {
     const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
     onProgress?.(percent)
   })
   return task
}

export async function resolveUploadResult(task: UploadTask): Promise<UploadResult> {
  await task
  const storagePath = task.snapshot.ref.fullPath
  const url = await getDownloadURL(task.snapshot.ref)
  return { url, storagePath }
}

export async function deleteMedia(storagePath: string): Promise<void> {
  await deleteObject(ref(getFirebaseStorage(), storagePath))
}
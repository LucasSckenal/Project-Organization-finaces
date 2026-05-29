import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const MAX_SIZE_MB = 5

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Photo must be under ${MAX_SIZE_MB}MB.`)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image.')
  }

  const ext     = file.name.split('.').pop() ?? 'jpg'
  const path    = `avatars/${uid}/profile.${ext}`
  const fileRef = ref(storage, path)

  await uploadBytes(fileRef, file, { contentType: file.type })
  return getDownloadURL(fileRef)
}

export async function deleteAvatar(uid: string) {
  try {
    // Try common extensions
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
      const fileRef = ref(storage, `avatars/${uid}/profile.${ext}`)
      await deleteObject(fileRef).catch(() => null)
    }
  } catch {
    // ignore — file might not exist
  }
}

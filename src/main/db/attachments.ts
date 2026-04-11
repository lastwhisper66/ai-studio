import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join, resolve, sep } from 'path'
import type { FileData, AttachmentMeta } from '@shared/types'
import { getDataDir } from '../utils/paths'

function getAttachmentsDir(): string {
  return join(getDataDir(), 'attachments')
}

export function saveAttachments(messageId: string, files: FileData[]): AttachmentMeta[] {
  const baseDir = getAttachmentsDir()
  const msgDir = join(baseDir, messageId)
  if (!existsSync(msgDir)) {
    mkdirSync(msgDir, { recursive: true })
  }

  const metas: AttachmentMeta[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `${i}.${ext}`
    const filePath = join(msgDir, filename)
    writeFileSync(filePath, Buffer.from(file.base64, 'base64'))
    metas.push({
      name: file.name,
      mimeType: file.mimeType,
      path: `${messageId}/${filename}`,
    })
  }
  return metas
}

export function loadAttachmentBase64(relativePath: string): string {
  const baseDir = resolve(getAttachmentsDir())
  const fullPath = resolve(baseDir, relativePath)
  if (!fullPath.startsWith(baseDir + sep)) {
    throw new Error('Invalid attachment path')
  }
  if (!existsSync(fullPath)) {
    throw new Error(`Attachment not found: ${relativePath}`)
  }
  return readFileSync(fullPath).toString('base64')
}

export function deleteAttachments(messageId: string): void {
  const msgDir = join(getAttachmentsDir(), messageId)
  if (existsSync(msgDir)) {
    rmSync(msgDir, { recursive: true, force: true })
  }
}

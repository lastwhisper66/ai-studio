import type { BackupRemote, RemoteObject } from './types'
import { classifyRemoteError, isNotFound } from './types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'
import { XMLParser } from 'fast-xml-parser'

export interface WebDAVOptions {
  url: string
  username: string
  password: string
  /** Subpath under the WebDAV root, e.g. `aistudio-backup`. Leading/trailing slashes are normalized. */
  subPath: string
}

export class WebDAVRemote implements BackupRemote {
  constructor(private opts: WebDAVOptions) {}

  private base(): string {
    const root = this.opts.url.replace(/\/+$/, '')
    const sub = this.opts.subPath.replace(/^\/+|\/+$/g, '')
    return sub ? `${root}/${sub}` : root
  }

  private url(path: string): string {
    const trimmed = path.replace(/^\/+/, '')
    return `${this.base()}/${trimmed}`
  }

  private auth(): string {
    return 'Basic ' + Buffer.from(`${this.opts.username}:${this.opts.password}`).toString('base64')
  }

  async put(path: string, bytes: Uint8Array, signal?: AbortSignal): Promise<void> {
    await this.ensureDirsFor(path, signal)
    let res: Response
    try {
      res = await fetch(this.url(path), {
        method: 'PUT',
        headers: {
          Authorization: this.auth(),
          'Content-Type': 'application/octet-stream',
        },
        body: bytes as BodyInit,
        signal,
      })
    } catch (e) {
      classifyRemoteError(null, e)
    }
    if (!res.ok) classifyRemoteError(res.status, new Error(`PUT ${path} → ${res.status}`))
  }

  async get(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    let res: Response
    try {
      res = await fetch(this.url(path), {
        method: 'GET',
        headers: { Authorization: this.auth() },
        signal,
      })
    } catch (e) {
      classifyRemoteError(null, e)
    }
    if (res.status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
    if (!res.ok) classifyRemoteError(res.status, new Error(`GET ${path} → ${res.status}`))
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  }

  async delete(path: string, signal?: AbortSignal): Promise<void> {
    let res: Response
    try {
      res = await fetch(this.url(path), {
        method: 'DELETE',
        headers: { Authorization: this.auth() },
        signal,
      })
    } catch (e) {
      classifyRemoteError(null, e)
    }
    if (res.status === 404) return
    if (!res.ok) classifyRemoteError(res.status, new Error(`DELETE ${path} → ${res.status}`))
  }

  async headLastModified(path: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const res = await fetch(this.url(path), {
        method: 'HEAD',
        headers: { Authorization: this.auth() },
        signal,
      })
      if (res.status === 404) return null
      if (!res.ok) classifyRemoteError(res.status, new Error(`HEAD ${path} → ${res.status}`))
      const lm = res.headers.get('last-modified')
      return lm ? new Date(lm).toISOString() : null
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  async list(prefix: string, signal?: AbortSignal): Promise<RemoteObject[]> {
    const url = this.url(prefix.endsWith('/') ? prefix : prefix + '/')
    const body = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.auth(),
          Depth: '1',
          'Content-Type': 'application/xml; charset=utf-8',
        },
        body,
        signal,
      })
    } catch (e) {
      classifyRemoteError(null, e)
    }
    if (res.status === 404) return []
    if (!res.ok) classifyRemoteError(res.status, new Error(`PROPFIND ${prefix} → ${res.status}`))
    const xml = await res.text()
    return parsePropfind(xml, this.base())
  }

  /**
   * MKCOL the chain of directories from the WebDAV root URL down to the
   * file's parent. This MUST include the configured `subPath` segments —
   * otherwise the first PUT into an existing-but-unprovisioned subPath fails:
   *   - 坚果云 (Jianguoyun) responds **403 Forbidden** for "PUT into a
   *     directory that doesn't exist yet"
   *   - other servers commonly use **409 Conflict** for the same condition
   *
   * MKCOL responses we treat as success:
   *   - 200/201 → created
   *   - 301      → redirect (server normalized the URL)
   *   - 405      → method-not-allowed, i.e. already exists as a collection
   *   - 403/409  → server may return either when the collection already
   *               exists and disallows MKCOL on it; the subsequent PUT will
   *               surface a real error if the path is genuinely inaccessible
   */
  private async ensureDirsFor(path: string, signal?: AbortSignal): Promise<void> {
    const root = this.opts.url.replace(/\/+$/, '')
    const subPathParts = (this.opts.subPath || '')
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean)
    const fileParts = path.replace(/^\/+/, '').split('/').filter(Boolean)
    // Everything before the file name itself: subPath segments + file's
    // intermediate dirs (drop the last element which is the filename).
    const dirSegments = [...subPathParts, ...fileParts.slice(0, -1)]
    if (dirSegments.length === 0) return

    let cumulative = root
    for (const segment of dirSegments) {
      cumulative += '/' + segment
      let res: Response
      try {
        res = await fetch(cumulative + '/', {
          method: 'MKCOL',
          headers: { Authorization: this.auth() },
          signal,
        })
      } catch (e) {
        classifyRemoteError(null, e)
      }
      if (![200, 201, 301, 403, 405, 409].includes(res.status)) {
        if (res.status >= 400) {
          classifyRemoteError(res.status, new Error(`MKCOL ${cumulative} → ${res.status}`))
        }
      }
    }
  }
}

/** Safe wrapper — returns the input unchanged if it can't be decoded. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Parse a PROPFIND multistatus response into a flat list of file resources.
 *
 * Uses fast-xml-parser with `removeNSPrefix: true` so the parser tolerates
 * any namespace prefix (`D:response`, `d:response`, `dav:response`, plain
 * `response`, …). The previous regex-based implementation broke on a few
 * non-mainstream WebDAV servers that emit prefixes other than `D:` or
 * include extra whitespace inside tags.
 *
 * Collections (directories) are filtered out — callers want files only.
 */
function parsePropfind(xml: string, baseUrl: string): RemoteObject[] {
  // `response` and `propstat` may appear multiple times; force them as arrays
  // so we don't have to special-case "exactly one" in the loop below. Other
  // tags can stay as scalars.
  const ALWAYS_ARRAY = new Set(['multistatus.response', 'multistatus.response.propstat'])
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false, // keep `getcontentlength` etc as strings; we coerce explicitly
    trimValues: true,
    isArray: (_name, jpath) => ALWAYS_ARRAY.has(String(jpath)),
  })

  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    return []
  }
  const responses = pickResponses(doc)
  if (responses.length === 0) return []

  // Use the URL parser to get a normalized pathname for the configured base.
  // String prefix matching (`startsWith`) breaks when the server canonicalizes
  // the URL — e.g. drops the default port, switches HTTPS variants, or returns
  // paths relative to the host rather than absolute URLs. URL pathnames are
  // a stable comparison surface.
  let basePathname = ''
  let baseOrigin = ''
  try {
    const u = new URL(baseUrl)
    baseOrigin = u.origin
    basePathname = u.pathname.replace(/\/+$/, '')
  } catch {
    /* keep empty values; fall back to literal href below */
  }

  const out: RemoteObject[] = []
  for (const r of responses) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    const href = typeof rec.href === 'string' ? rec.href : undefined
    if (!href) continue

    // Find the first <propstat> with a 2xx <status>; PROPFIND can split props
    // across multiple propstat blocks (e.g. one for HTTP 200 props, one for
    // HTTP 404 props). For our use-case (existence + size + lastModified)
    // any block that exposes the props we want is fine.
    const propstats = (rec.propstat ?? []) as Array<Record<string, unknown>>
    let prop: Record<string, unknown> | undefined
    for (const ps of propstats) {
      if (!ps || typeof ps !== 'object') continue
      const candidate = ps.prop as Record<string, unknown> | undefined
      if (candidate && typeof candidate === 'object') {
        prop = candidate
        break
      }
    }
    if (!prop) continue

    // <resourcetype><collection/></resourcetype> → directory; skip.
    const resourcetype = prop.resourcetype as Record<string, unknown> | string | undefined
    const isCollection =
      typeof resourcetype === 'object' && resourcetype !== null && 'collection' in resourcetype
    if (isCollection) continue

    const lengthStr = String(prop.getcontentlength ?? '0')
    const lastModStr = String(prop.getlastmodified ?? '')

    // Resolve the response href against the base URL, then strip the base
    // pathname so what callers see is a clean key relative to the configured
    // backup root (e.g. `backups/xxx.aibackup`). Falls back to a literal
    // strip when the href can't be parsed.
    let key: string | null = null
    try {
      const resolved = new URL(href, baseOrigin || undefined)
      let p = resolved.pathname
      if (basePathname && p.startsWith(basePathname)) {
        p = p.slice(basePathname.length)
      }
      key = safeDecode(p.replace(/^\/+/, ''))
    } catch {
      key = safeDecode(href.replace(/^\/+/, ''))
    }
    if (!key) continue

    out.push({
      key,
      size: parseInt(lengthStr, 10) || 0,
      lastModified: lastModStr ? new Date(lastModStr).toISOString() : '',
    })
  }
  return out
}

function pickResponses(doc: unknown): unknown[] {
  if (!doc || typeof doc !== 'object') return []
  const root = (doc as Record<string, unknown>).multistatus
  if (!root || typeof root !== 'object') return []
  const r = (root as Record<string, unknown>).response
  if (Array.isArray(r)) return r
  if (r && typeof r === 'object') return [r]
  return []
}

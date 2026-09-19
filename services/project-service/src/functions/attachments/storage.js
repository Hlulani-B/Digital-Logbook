import { AttachmentError, BUCKET, SIGNED_URL_SECONDS, safeName } from './policy.js';

export function createAttachmentStorage({
  fetchImpl = (...args) => fetch(...args),
  env = process.env,
} = {}) {
  function config() {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    let base;
    try {
      base = new URL(env.SUPABASE_URL);
    } catch {
      /* handled below */
    }
    if (
      !key ||
      !base ||
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new AttachmentError(
        'Private attachment storage is not configured.',
        503,
        'STORAGE_UNAVAILABLE'
      );
    }
    return { key, base: base.origin + '/storage/v1' };
  }
  function objectPath(key) {
    if (!/^\d+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]+$/.test(key)) {
      throw new AttachmentError('Invalid storage reference.', 500);
    }
    return `${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async function call(path, options, allowMissing = false) {
    const { key, base } = config();
    try {
      const response = await fetchImpl(`${base}${path}`, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, ...options.headers },
      });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error('Storage request failed');
      return response;
    } catch {
      // Never expose storage response bodies, keys, or credentials to the caller.
      throw new AttachmentError(
        'Private attachment storage request failed.',
        502,
        'STORAGE_UNAVAILABLE'
      );
    }
  }
  return {
    assertConfigured: config,
    async upload(key, bytes, mimeType) {
      await call(`/object/${objectPath(key)}`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'x-upsert': 'false',
          'Cache-Control': 'private, max-age=0',
        },
        body: bytes,
      });
    },
    async remove(key) {
      objectPath(key);
      await call(
        `/object/${BUCKET}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: [key] }),
        },
        true
      );
    },
    async sign(key, name, mimeType) {
      const path = objectPath(key);
      const response = await call(`/object/sign/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
      });
      try {
        const body = await response.json();
        const { base } = config();
        const signed = body.signedURL ?? body.signedUrl;
        if (typeof signed !== 'string' || !signed.startsWith(`/object/sign/${path}?`))
          throw new Error();
        const url = new URL(`${base}${signed}`);
        if (!url.searchParams.get('token')) throw new Error();
        if (!mimeType.startsWith('image/')) {
          const download = safeName(name).replace(/[^a-zA-Z0-9._ -]/g, '_');
          url.searchParams.set('download', download);
        }
        return url.toString();
      } catch {
        throw new AttachmentError('Unable to sign attachment access.', 502, 'STORAGE_UNAVAILABLE');
      }
    },
  };
}

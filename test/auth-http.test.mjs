// node --test test/auth-http.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { AxiosError } from 'axios'

let sequence = 0
async function loadHttp(storage = new Map()) {
  globalThis.window = new EventTarget()
  globalThis.localStorage = {
    getItem(key) {
      return storage.get(key) ?? null
    },
    setItem(key, value) {
      storage.set(key, value)
    },
    removeItem(key) {
      storage.delete(key)
    },
  }
  globalThis.sessionStorage = { removeItem() {} }
  globalThis.BroadcastChannel = class {
    postMessage() {}
  }
  let tail = Promise.resolve()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request(_name, action) {
          const next = tail.then(action)
          tail = next.catch(() => {})
          return next
        },
      },
    },
  })
  const source = (await readFile(new URL('../src/api/http.ts', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env', '({})')
    .replace("from 'axios'", `from '${import.meta.resolve('axios')}'`)
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText + `\n// ${sequence++}`).toString('base64')}`
  )
}
function success(config, data) {
  return { config, status: 200, statusText: 'OK', headers: {}, data: { data } }
}

test('reload reuses unexpired localStorage token without refreshing', async () => {
  const storage = new Map()
  const first = await loadHttp(storage)
  first.setAccessToken('persisted', 900)
  const reloaded = await loadHttp(storage)
  let refreshes = 0
  reloaded.authHttp.defaults.adapter = async () => {
    refreshes++
    throw new Error('unexpected refresh')
  }
  await reloaded.restoreSession()
  assert.equal(reloaded.getAccessToken(), 'persisted')
  assert.equal(refreshes, 0)
})

test('reload refreshes expired token and persists replacement', async () => {
  const storage = new Map([
    ['access_token', JSON.stringify({ token: 'expired', expiresAt: Date.now() - 1000 })],
  ])
  const api = await loadHttp(storage)
  let refreshes = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    return success(config, { accessToken: 'renewed', expiresIn: 900 })
  }
  await Promise.all([api.restoreSession(), api.restoreSession()])
  assert.equal(refreshes, 1)
  assert.equal(JSON.parse(storage.get('access_token')).token, 'renewed')
  api.clearAccessToken()
  assert.equal(storage.has('access_token'), false)
})

test('expired token is refreshed before sending business request', async () => {
  const api = await loadHttp()
  api.setAccessToken('expired', -1)
  api.authHttp.defaults.adapter = async (config) =>
    success(config, { accessToken: 'renewed', expiresIn: 900 })
  api.http.defaults.adapter = async (config) => {
    assert.equal(config.headers.Authorization, 'Bearer renewed')
    return success(config, { ok: true })
  }
  await api.request({ url: '/private' })
})
function failure(config, status, code) {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', config, null, {
    config,
    status,
    statusText: 'Error',
    headers: {},
    data: { code },
  })
}

test('concurrent expired business requests refresh once and preserve original request', async () => {
  const api = await loadHttp()
  api.setAccessToken('old', 900)
  let refreshes = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    assert.equal(config.url, '/v1/auth/refresh')
    assert.equal(config.withCredentials, true)
    assert.equal(config.headers['X-Auth-Request'], '1')
    await new Promise((resolve) => setTimeout(resolve, 10))
    return success(config, { accessToken: 'new', expiresIn: 900 })
  }
  let attempts = 0
  api.http.defaults.adapter = async (config) => {
    attempts++
    assert.equal(config.url, '/v1/quest-records')
    assert.equal(config.method, 'post')
    assert.equal(config.data, '{"questId":1}')
    if (config.headers.Authorization === 'Bearer old')
      throw failure(config, 401, 'ACCESS_TOKEN_EXPIRED')
    assert.equal(config.headers.Authorization, 'Bearer new')
    return success(config, { id: 1 })
  }
  await Promise.all(
    Array.from({ length: 5 }, () =>
      api.request({ method: 'POST', url: '/v1/quest-records', data: { questId: 1 } }),
    ),
  )
  assert.equal(refreshes, 1)
  assert.equal(attempts, 10)
})

test('second 401 stops retry and clears authentication', async () => {
  const api = await loadHttp()
  api.setAccessToken('old', 900)
  let refreshes = 0
  let calls = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    return success(config, { accessToken: 'new', expiresIn: 900 })
  }
  api.http.defaults.adapter = async (config) => {
    calls++
    throw failure(config, 401, 'ACCESS_TOKEN_EXPIRED')
  }
  await assert.rejects(api.request({ url: '/private' }))
  assert.equal(refreshes, 1)
  assert.equal(calls, 2)
  assert.equal(api.getAccessToken(), null)
})

test('403 never refreshes; refresh 500 preserves login and does not replay business request', async () => {
  const api = await loadHttp()
  api.setAccessToken('old', 900)
  let refreshes = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    throw failure(config, 500, 'INTERNAL_ERROR')
  }
  api.http.defaults.adapter = async (config) => {
    throw failure(config, 403, 'FORBIDDEN')
  }
  await assert.rejects(api.request({ url: '/private' }))
  assert.equal(refreshes, 0)
  api.http.defaults.adapter = async (config) => {
    throw failure(config, 401, 'ACCESS_TOKEN_EXPIRED')
  }
  await assert.rejects(api.request({ url: '/private' }))
  assert.equal(refreshes, 1)
  assert.equal(api.getAccessToken(), 'old')
})

test('page restoration shares one refresh; refresh 401 is terminal', async () => {
  const api = await loadHttp()
  let refreshes = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    return success(config, { accessToken: 'restored', expiresIn: 900 })
  }
  await Promise.all([api.restoreSession(), api.restoreSession()])
  assert.equal(refreshes, 1)
  assert.equal(api.getAccessToken(), 'restored')
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    throw failure(config, 401, 'SESSION_INVALID')
  }
  await assert.rejects(api.refreshAccessToken())
  assert.equal(refreshes, 2)
  assert.equal(api.getAccessToken(), null)
})

test('late expired response after logout cannot restore login', async () => {
  const api = await loadHttp()
  api.setAccessToken('old', 900)
  let refreshes = 0
  api.authHttp.defaults.adapter = async (config) => {
    refreshes++
    return success(config, { accessToken: 'new', expiresIn: 900 })
  }
  api.http.defaults.adapter = async (config) => {
    api.clearAccessToken()
    throw failure(config, 401, 'ACCESS_TOKEN_EXPIRED')
  }
  await assert.rejects(api.request({ url: '/private' }))
  assert.equal(refreshes, 0)
  assert.equal(api.getAccessToken(), null)
})

test('late request from previous account cannot be replayed with new account token', async () => {
  const api = await loadHttp()
  api.setAccessToken('account-a', 900)
  let calls = 0
  api.http.defaults.adapter = async (config) => {
    calls++
    api.clearAccessToken()
    api.setAccessToken('account-b', 900)
    throw failure(config, 401, 'ACCESS_TOKEN_EXPIRED')
  }
  await assert.rejects(api.request({ method: 'POST', url: '/private' }))
  assert.equal(calls, 1)
  assert.equal(api.getAccessToken(), 'account-b')
})

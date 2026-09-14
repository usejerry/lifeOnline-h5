import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

let sequence = 0

async function loadStore(overrides = {}) {
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  globalThis.__messageTest = {
    token: 'token',
    getMessages: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    getUnreadMessageCount: async () => ({ count: 0 }),
    markMessageAsRead: async () => {
      throw new Error('unexpected mark')
    },
    markAllMessagesAsRead: async () => ({ affected: 0 }),
    ...overrides,
  }

  const httpMock = `export const getAccessToken = () => globalThis.__messageTest.token`
  const messagesMock = `
    export const getMessages = (...args) => globalThis.__messageTest.getMessages(...args)
    export const getUnreadMessageCount = (...args) => globalThis.__messageTest.getUnreadMessageCount(...args)
    export const markMessageAsRead = (...args) => globalThis.__messageTest.markMessageAsRead(...args)
    export const markAllMessagesAsRead = (...args) => globalThis.__messageTest.markAllMessagesAsRead(...args)
  `
  const moduleUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  const source = await readFile(new URL('../src/stores/messages.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  const executable = outputText
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replace("from 'pinia'", `from '${import.meta.resolve('pinia')}'`)
    .replace("from '@/api/http'", `from '${moduleUrl(httpMock)}'`)
    .replace("from '@/api/messages'", `from '${moduleUrl(messagesMock)}'`)

  setActivePinia(createPinia())
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(`${executable}\n// ${sequence++}`).toString('base64')}`
  )
  return module.useMessagesStore()
}

const unreadMessage = {
  id: 7,
  type: 'daily_sign_in_reminder',
  title: '今天还没有签到',
  content: '来留下今天的脚印吧。',
  businessId: '2026-09-14',
  payload: { businessDate: '2026-09-14' },
  readAt: null,
  createdAt: '2026-09-14T12:00:00.000Z',
}

test('loading the inbox preserves unread state', async () => {
  let markCalls = 0
  const store = await loadStore({
    getMessages: async () => ({ items: [unreadMessage], total: 1, page: 1, pageSize: 20 }),
    markMessageAsRead: async () => {
      markCalls += 1
      return { ...unreadMessage, readAt: '2026-09-14T12:01:00.000Z' }
    },
  })

  await store.loadMessages(true)

  assert.equal(store.items[0].readAt, null)
  assert.equal(markCalls, 0)
})

test('failed read request does not optimistically mark the message', async () => {
  const store = await loadStore({
    getMessages: async () => ({ items: [unreadMessage], total: 1, page: 1, pageSize: 20 }),
    getUnreadMessageCount: async () => ({ count: 1 }),
    markMessageAsRead: async () => {
      throw new Error('offline')
    },
  })
  await store.loadMessages(true)
  await store.loadUnreadCount()

  const result = await store.markAsRead(unreadMessage.id)

  assert.equal(result, null)
  assert.equal(store.items[0].readAt, null)
  assert.equal(store.unreadCount, 1)
  assert.match(store.actionError, /重试/)
})

test('a late inbox response cannot repopulate state after account clear', async () => {
  let resolveRequest
  const response = new Promise((resolve) => {
    resolveRequest = resolve
  })
  const store = await loadStore({ getMessages: () => response })

  const request = store.loadMessages(true)
  globalThis.__messageTest.token = null
  window.dispatchEvent(new Event('auth:cleared'))
  resolveRequest({ items: [unreadMessage], total: 1, page: 1, pageSize: 20 })
  await request

  assert.deepEqual(store.items, [])
  assert.equal(store.total, 0)
  assert.equal(store.unreadCount, null)
})

import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Run after the actual client + SSR build, including web-only Docker builds.
const directory =
  process.argv[2] || fileURLToPath(new URL('../build', import.meta.url))
const server = await readFile(path.join(directory, 'server/index.js'), 'utf8')
const referenced = [
  ...new Set(
    [...server.matchAll(/\/assets\/(tailwind-[A-Za-z0-9_-]+\.css)/g)].map(
      (match) => match[1],
    ),
  ),
]
const emitted = (await readdir(path.join(directory, 'client/assets'))).filter(
  (name) => /^tailwind-[A-Za-z0-9_-]+\.css$/.test(name),
)
assert.equal(referenced.length, 1, 'SSR must reference one Tailwind stylesheet')
assert.deepEqual(
  emitted.sort(),
  referenced,
  'Client and SSR Tailwind stylesheets differ; exclude generated build output from source detection',
)
console.log(`Client and SSR stylesheet verified: ${referenced[0]}`)

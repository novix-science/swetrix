// Novix HTTPS proxy adapter, 2026-11-05, AGPL-3.0.
// Use React Router's public Express adapter with the existing CE build.
import express from 'express'
import path from 'node:path'
import { createRequestHandler } from '@react-router/express'
import * as build from './build/server/index.js'

const app = express()
// Only the dedicated Docker subnet can supply proxy protocol/host headers.
// The frontend has no host port; Caddy overwrites these headers at the edge.
app.set('trust proxy', '172.30.221.0/24')
app.disable('x-powered-by')
const assets = path.resolve(build.assetsBuildDirectory)
app.use('/assets', express.static(path.join(assets, 'assets'), {
  immutable: true, maxAge: '1y',
}))
app.use(express.static(assets))
app.use(express.static('public', { maxAge: '1h' }))
app.all('/{*splat}', createRequestHandler({ build, mode: 'production' }))
app.listen(3000, '0.0.0.0', () => console.log('Swetrix CE frontend listening on port 3000'))

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const mcpDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'mcp')
const distEntry = join(mcpDir, 'dist', 'index.js')
const useDist = existsSync(distEntry)

const command = useDist ? process.execPath : (process.platform === 'win32' ? 'npx.cmd' : 'npx')
const args = useDist ? [distEntry] : ['tsx', 'src/index.ts']

const child = spawn(command, args, {
  cwd: mcpDir,
  stdio: 'inherit',
  env: process.env,
  shell: !useDist && process.platform === 'win32',
})
child.on('exit', (code) => process.exit(code ?? 1))
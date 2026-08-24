import { PrismaClient } from '@prisma/client'
import path from 'path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (url) {
    if (url.startsWith('file:./')) {
      const rel = url.replace('file:./', '')
      const abs = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rel)
      return `file:${abs.replace(/\\/g, '/')}`
    }
    return url
  }
  const fallback = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'db/custom.db')
  return `file:${fallback.replace(/\\/g, '/')}`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
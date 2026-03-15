import 'dotenv/config'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Parse CLI args: --name "x" --capabilities "cpp,cuda:12.6"
function parseArgs(): { name: string; capabilities: string[] } {
  const args = process.argv.slice(2)
  let name = ''
  let capabilitiesRaw = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i]
    } else if (args[i] === '--capabilities' && args[i + 1]) {
      capabilitiesRaw = args[++i]
    }
  }

  if (!name) {
    console.error('Usage: tsx scripts/create-judge-token.ts --name <name> --capabilities <csv>')
    console.error('Example: tsx scripts/create-judge-token.ts --name gpu-helsinki --capabilities "cpp,cuda:12.6"')
    process.exit(1)
  }
  if (!capabilitiesRaw) {
    console.error('--capabilities is required (e.g. "cpp" or "cpp,cuda:12.6")')
    process.exit(1)
  }

  const capabilities = capabilitiesRaw.split(',').map((c) => c.trim()).filter(Boolean)
  return { name, capabilities }
}

async function main() {
  const { name, capabilities } = parseArgs()

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  // Generate jt_ + 32 random bytes as hex (67 chars total)
  const rawToken = 'jt_' + crypto.randomBytes(32).toString('hex')

  // Hash with SHA-256 for storage — never store the raw token
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  try {
    await prisma.judgeToken.create({
      data: {
        name,
        token: tokenHash,
        capabilities,
      },
    })

    console.log('\n✅ Judge token created successfully')
    console.log(`   Name:         ${name}`)
    console.log(`   Capabilities: ${capabilities.join(', ')}`)
    console.log('\n🔑 Token (save this — it will never be shown again):')
    console.log(`\n   ${rawToken}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Failed to create judge token:', err)
  process.exit(1)
})

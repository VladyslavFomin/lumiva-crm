import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AuthService } from './auth/auth.service'
import { SettingsService } from './settings/settings.service'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })

  const auth = app.get(AuthService)
  const settings = app.get(SettingsService)

  await auth.createAdmin(
    process.env.ADMIN_EMAIL || 'admin@lumiva.agency',
    process.env.ADMIN_PASSWORD || 'LumivaAdmin2026!',
  )
  console.log(`Admin user seeded: ${process.env.ADMIN_EMAIL || 'admin@lumiva.agency'}`)

  await settings.bulkSet([
    { key: 'site_name', value: 'Lumiva Agency', label: 'Site Name', group: 'general' },
    { key: 'site_url', value: 'https://lumiva.agency', label: 'Site URL', group: 'general' },
    { key: 'contact_email', value: 'hello@lumiva.agency', label: 'Contact Email', group: 'general' },
    { key: 'crm_enabled', value: 'false', label: 'CRM Integration Enabled', group: 'integrations' },
    { key: 'n8n_enabled', value: 'false', label: 'N8N Webhook Enabled', group: 'integrations' },
    { key: 'notify_email', value: 'vlad@lumiva.agency', label: 'Notification Email', group: 'notifications' },
  ])
  console.log('Default settings seeded')

  await app.close()
  process.exit(0)
}

bootstrap().catch(e => { console.error(e); process.exit(1) })

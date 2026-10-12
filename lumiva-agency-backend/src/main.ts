import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import * as helmet from 'helmet'
import { join } from 'path'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use((helmet as any).default())

  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'https://lumiva.agency').split(',').concat(['https://pl2.lumiva.agency']),
    credentials: true,
  })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const config = new DocumentBuilder()
    .setTitle('Lumiva Agency API')
    .setDescription('Admin API for lumiva.agency CMS')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT || 3010
  await app.listen(port)
  console.log(`🚀 Lumiva Agency Backend running on port ${port}`)
}

bootstrap()

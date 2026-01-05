import 'dotenv/config'
import type { MiddlewareConsumer } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { HTTPLoggerMiddleware } from './middleware/req.res.logger'
// import { PrismaService } from 'src/prisma.service'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from './users/users.module'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { MetricsController } from './metrics.controller'
import { TerminusModule } from '@nestjs/terminus'
import {FileTransferController} from './ftp/controllers/outbound.file.controller'
import {FileTransferService} from './ftp/services/outbound.file.service'
// import { HealthController } from './health.controller'

@Module({
  imports: [ConfigModule.forRoot(), TerminusModule],
  // controllers: [AppController, MetricsController, HealthController],
  controllers: [AppController, MetricsController, FileTransferController],
  providers: [AppService, FileTransferService],
})
export class AppModule {
  // let's add a middleware on all routes
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HTTPLoggerMiddleware)
      .exclude(
        { path: 'metrics', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
      )
      .forRoutes('*')
  }
}

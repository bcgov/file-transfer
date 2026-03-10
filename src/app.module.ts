import 'dotenv/config'
import type { MiddlewareConsumer } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { HTTPLoggerMiddleware } from './middleware/req.res.logger'
import { ConfigModule } from '@nestjs/config'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { MetricsController } from './metrics/metrics.controller'
import { TerminusModule } from '@nestjs/terminus'
import { TransferModule } from './transfer/transfer.module'
import { HealthController } from './health/health.controller'

@Module({
  imports: [ConfigModule.forRoot(), TerminusModule, TransferModule],
  controllers: [AppController, MetricsController, HealthController],
  providers: [AppService],
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

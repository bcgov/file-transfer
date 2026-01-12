import 'dotenv/config'
import type { MiddlewareConsumer } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { HTTPLoggerMiddleware } from './middleware/req.res.logger'
import { ConfigModule } from '@nestjs/config'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { MetricsController } from './metrics.controller'
import { TerminusModule } from '@nestjs/terminus'
import { FtpModule } from './ftp/ftp.module'
// import { HealthController } from './health.controller'

@Module({
  imports: [ConfigModule.forRoot(), TerminusModule, FtpModule],
  // controllers: [AppController, MetricsController, HealthController],
  controllers: [AppController, MetricsController],
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

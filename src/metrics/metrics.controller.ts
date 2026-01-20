import { Controller, Get, Res, Logger, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { register } from 'src/middleware/prom'

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name)
  @Get()
  async getMetrics(@Res() res: Response) {
    try {
      const appMetrics = await register.metrics()
      res.end(appMetrics)
    } catch (error) {
      this.logger.error('Failed to get metrics', error)
      throw new HttpException('Metrics collection failed', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}

import { Module } from '@nestjs/common'
import { FtpOutboundService } from './services/outbound.file.service'
import { FtpOutboundController } from './controllers/outbound.file.controller'
import { FtpClientService } from './services/ftp-client.service'

@Module({
  controllers: [FtpOutboundController],
  providers: [FtpOutboundService, FtpClientService],
})
export class FtpModule {}

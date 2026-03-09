import { Module } from '@nestjs/common'
import { TransferOutboundService } from './services/outbound-file.service'
import { TransferOutboundController } from './controllers/outbound.file.controller'
import { S3ClientService } from './services/s3-client.service'

@Module({
  controllers: [TransferOutboundController],
  providers: [TransferOutboundService, S3ClientService],
})
export class TransferModule {}

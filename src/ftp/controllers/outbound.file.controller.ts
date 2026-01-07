import {
  Body,
  Controller,
  Post,
  Get,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FtpOutboundService } from '../services/outbound.file.service';
import { CreateFileDto } from '../dto/outbound.file.dto';
import { Logger } from '@nestjs/common';

@Controller('file')
export class FtpOutboundController {
  private readonly logger = new Logger(FtpOutboundController.name)
  constructor(private readonly FtpOutboundService: FtpOutboundService) { }

  @Post('upload')
  async uploadFile(@Body() dto: CreateFileDto) {
    try {
      const result = await this.FtpOutboundService.processAndUpload(dto);
      return {
        status: 'SUCCESS',
        fileName: result.fileName,
        message: 'File successfully created and uploaded to FTP',
      };
    } catch (error) {
      this.logger.log('FtpOutBoundController catch block error', error)
      throw new HttpException(
        {
          status: 'FAILED',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download')
  async downloadFile(){
    return this.FtpOutboundService.downloadFile()
  }

}

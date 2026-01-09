import {
  Body,
  Controller,
  Post,
  Get,
  Headers,
  HttpStatus,
  HttpException,
  UploadedFile,
  UseInterceptors,
  BadRequestException
} from '@nestjs/common';
import { FtpOutboundService } from '../services/outbound.file.service';
import { CreateFileDto } from '../dto/outbound.file.dto';
import { Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';

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

  @Post('upload-to-cta')
  @UseInterceptors(FileInterceptor('file'))
  async uploadfiletoCra(
    @UploadedFile() file: MulterFile,
    @Headers('servicename') serviceName: string,
    @Headers('userid') userId: string
  ) {
    console.log('File to upload to cra', file, serviceName, userId)

        if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!serviceName || !userId) {
      throw new BadRequestException(
        'servicename and userid are required in headers',
      );
    }

  return  await this.FtpOutboundService.uploadFileToCra(file, userId, serviceName)

   

  }

  @Get('download')
  async downloadFile() {
    return this.FtpOutboundService.downloadFile()
  }

}

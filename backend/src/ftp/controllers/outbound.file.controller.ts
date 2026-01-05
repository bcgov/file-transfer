import {
  Body,
  Controller,
  Post,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileTransferService } from '../services/outbound.file.service';
import { CreateFileDto } from '../dto/outbound.file.dto';

@Controller('file-transfer')
export class FileTransferController {
  constructor(private readonly fileTransferService: FileTransferService) {}

  @Post('upload')
  async uploadFile(@Body() dto: CreateFileDto) {
    try {
      const result = await this.fileTransferService.processAndUpload(dto);
      return {
        status: 'SUCCESS',
        fileName: result.fileName,
        message: 'File successfully created and uploaded to FTP',
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'FAILED',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

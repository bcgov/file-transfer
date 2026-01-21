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
  BadRequestException,
} from '@nestjs/common'
import { FtpOutboundService } from '../services/outbound.file.service'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { Logger } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { File as MulterFile } from 'multer'
import { UploadFileHeaders } from '../interfaces/outbound.interface'
import {
  ApiTags,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger'
import { OutboundUploadResponseDto } from '../dto/outbound.response.dto'

@ApiTags('FTP')
@Controller()
export class FtpOutboundController {
  private readonly logger = new Logger(FtpOutboundController.name)
  constructor(private readonly FtpOutboundService: FtpOutboundService) {}

  @Post('upload')
  async uploadFile(@Body() dto: CreateFileDto) {
    try {
      const result = await this.FtpOutboundService.processAndUpload(dto)
      return {
        status: 'SUCCESS',
        fileName: result.fileName,
        message: 'File successfully created and uploaded to FTP',
      }
    } catch (error) {
      this.logger.log('FtpOutBoundController catch block error', error)
      throw new HttpException(
        {
          status: 'FAILED',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Upload file to FTP Server' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'servicename',
    description: 'Service Identifier (e.g., csa-backendservice)',
    required: true,
    example: 'csa-backendservice',
  })
  @ApiHeader({
    name: 'userid',
    description: 'User Identifier (e.g., testuser)',
    required: true,
    example: 'testuser',
  })
  @ApiBody({
    description: 'Upload a .txt file only',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Text file (.txt only)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    type: OutboundUploadResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadfiletoCra(@UploadedFile() file: MulterFile, @Headers() headers: UploadFileHeaders) {
    console.log('File to upload to cra', file, headers)
    try {
      if (!file) {
        throw new BadRequestException('File is required')
      }
      // if (!headers.servicename || !headers.userid) {
      //   throw new BadRequestException(
      //     'servicename and userid are required in headers',
      //   );
      // }

      return await this.FtpOutboundService.uploadFileToCra({ file, headers })
    } catch (error) {
      console.log('Error in uploadfiletoCra controller', error)
      throw new HttpException(
        {
          status: 'FAILED',
          message: error.message,
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('download')
  async downloadFile() {
    return this.FtpOutboundService.downloadFile()
  }
}

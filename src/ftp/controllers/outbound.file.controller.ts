import {
  Body,
  Controller,
  Post,
  Get,
  HttpStatus,
  HttpException,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FtpOutboundService } from '../services/outbound-file.service'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { Logger } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { File as MulterFile } from 'multer'
import { ApiTags, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { OutboundUploadResponseDto } from '../dto/outbound.response.dto'
import { COMMON_CONSTANT } from '../../common/common.constant'

const { DESTINATION_ID } = COMMON_CONSTANT

@ApiTags('FTP')
@Controller('v1')
export class FtpOutboundController {
  private readonly logger = new Logger(FtpOutboundController.name)
  constructor(private readonly FtpOutboundService: FtpOutboundService) {}

  @Post('transfers')
  @ApiOperation({ summary: 'Upload file to FTP Server' })
  @ApiConsumes('multipart/form-data')
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
  async uploadfiletoCra(@UploadedFile() file: MulterFile, @Body() body: CreateFileDto) {
    const { fileName, destinationId } = body
    this.logger.log(
      `Received file: ${file?.originalname}, destinationId: ${destinationId}, fileName: ${fileName}`,
    )
    try {
      if (!file) {
        throw new BadRequestException('File is required')
      }
      if (!destinationId || !fileName) {
        this.logger.log('Missing destinationId or fileName in the request body')
        throw new BadRequestException('destinationId and fileName are required in the body')
      }
      if (!DESTINATION_ID.includes(destinationId)) {
        throw new BadRequestException(`destinationId is invalid use one of [${DESTINATION_ID}] it `)
      }

      return await this.FtpOutboundService.uploadFileToCra({ file, destinationId, fileName })
    } catch (error) {
      this.logger.error('Error uploading file to CRA FTP', error)
      throw new HttpException(
        {
          status: 'FAILED',
          statusCode: error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message,
        },
        error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('download')
  async downloadFile() {
    return this.FtpOutboundService.downloadFile()
  }
}

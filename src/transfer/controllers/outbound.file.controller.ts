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
  Param,
  Res,
} from '@nestjs/common'
import path from 'path'
import fs from 'fs'
import { Response } from 'express'
import { TransferOutboundService } from '../services/outbound-file.service'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { Logger } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { File as MulterFile } from 'multer'
import { ApiTags, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UploadResponseDto, DeliveryStatusResponseDto } from '../dto/outbound.response.dto'
import { COMMON_CONSTANT } from '../../common/common.constant'

const { DESTINATION_ID, RESPONSE_STATUS } = COMMON_CONSTANT

@ApiTags('Transfers')
@Controller('destinations/:destinationId')
export class TransferOutboundController {
  private readonly logger = new Logger(TransferOutboundController.name)
  constructor(private readonly transferOutboundService: TransferOutboundService) {}

  private validateDestinationId(destinationId: string) {
    if (!DESTINATION_ID.includes(destinationId)) {
      throw new BadRequestException(`Invalid destinationId, use one of [${DESTINATION_ID}]`)
    }
  }

  private validateFileName(fileName: string) {
    if (fileName !== path.basename(fileName) || fileName.includes('..')) {
      throw new BadRequestException('Invalid fileName')
    }
  }

  private getHttpStatus(error: any): number {
    const status = error?.status
    return typeof status === 'number' ? status : HttpStatus.INTERNAL_SERVER_ERROR
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Upload file to storage' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully', type: UploadResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload a file',
    schema: {
      type: 'object',
      required: ['file', 'fileName'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        fileName: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('destinationId') destinationId: string,
    @UploadedFile() file: MulterFile,
    @Body() body: CreateFileDto,
  ) {
    const { fileName } = body
    this.logger.log(
      `Received file: ${file?.originalname}, destinationId: ${destinationId}, fileName: ${fileName}`,
    )
    try {
      if (!file) {
        throw new BadRequestException('File is required')
      }
      if (!fileName) {
        throw new BadRequestException('fileName is required in the body')
      }
      this.validateDestinationId(destinationId)
      this.validateFileName(fileName)

      return await this.transferOutboundService.uploadFile({ file, destinationId, fileName })
    } catch (error) {
      this.logger.error('Error uploading file', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message,
        },
        statusCode,
      )
    }
  }

  @Get('transfers/outbound')
  @ApiOperation({ summary: 'List sent files' })
  listOutboundFiles(@Param('destinationId') destinationId: string) {
    try {
      this.validateDestinationId(destinationId)
      return this.transferOutboundService.listOutboundFiles(destinationId)
    } catch (error) {
      this.logger.error('Error listing outbound files', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message,
        },
        statusCode,
      )
    }
  }

  @Get('transfers/inbound')
  @ApiOperation({ summary: 'List received files' })
  async listInboundFiles(@Param('destinationId') destinationId: string) {
    try {
      this.validateDestinationId(destinationId)
      return await this.transferOutboundService.listInboundFiles(destinationId)
    } catch (error) {
      this.logger.error('Error listing inbound files', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message,
        },
        statusCode,
      )
    }
  }

  @Get('transfers/:fileName/status')
  @ApiOperation({ summary: 'Check file delivery status' })
  @ApiResponse({ status: 200, description: 'Delivery status', type: DeliveryStatusResponseDto })
  async checkFileDeliveryStatus(
    @Param('destinationId') destinationId: string,
    @Param('fileName') fileName: string,
  ) {
    try {
      this.validateDestinationId(destinationId)
      this.validateFileName(fileName)
      return this.transferOutboundService.checkFileDeliveryStatus(destinationId, fileName)
    } catch (error) {
      this.logger.error('Error checking delivery status', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message,
        },
        statusCode,
      )
    }
  }

  @Get('transfers/:fileName')
  @ApiOperation({ summary: 'Download a file' })
  async downloadFile(
    @Param('destinationId') destinationId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    try {
      this.validateDestinationId(destinationId)
      this.validateFileName(fileName)
      const { filePath } = await this.transferOutboundService.downloadFile(destinationId, fileName)

      const stream = fs.createReadStream(filePath)
      stream.pipe(res)
      stream.on('close', async () => {
        await fs.promises.unlink(filePath)
      })
    } catch (error) {
      this.logger.error('Error downloading file', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message || 'Download failed',
        },
        statusCode,
      )
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Storage health check' })
  async storageHealthCheck(@Param('destinationId') destinationId: string) {
    try {
      this.validateDestinationId(destinationId)
      return this.transferOutboundService.storageHealthCheck()
    } catch (error) {
      this.logger.error('Error in storage health check', error?.stack, error?.message)
      const statusCode = this.getHttpStatus(error)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode,
          message: error?.message || 'Storage is not reachable',
        },
        statusCode,
      )
    }
  }
}

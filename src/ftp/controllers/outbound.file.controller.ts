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
import fs from 'fs'
import { Response } from 'express'
import { FtpOutboundService } from '../services/outbound-file.service'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { Logger } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { File as MulterFile } from 'multer'
import { ApiTags, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { OutboundUploadResponseDto } from '../dto/outbound.response.dto'
import { COMMON_CONSTANT } from '../../common/common.constant'

const { DESTINATION_ID, RESPONSE_STATUS } = COMMON_CONSTANT

@ApiTags('FTP')
@Controller()
export class FtpOutboundController {
  private readonly logger = new Logger(FtpOutboundController.name)
  constructor(private readonly FtpOutboundService: FtpOutboundService) { }

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
      this.logger.error('Error uploading file to CRA FTP', error?.stack, error?.message)
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message,
        },
        error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('transfers/:destinationId/:fileName')
  async checkFileDeliveryStatus(
    @Param('destinationId') destinationId: string,
    @Param('fileName') fileName: string,
  ) {
    try {
      this.logger.log(
        `Received data in params for File Delivery Status, destinationId : ${destinationId}, fileName: ${fileName}`,
      )
      if (!destinationId || !fileName) {
        throw new BadRequestException('destinationId or fileName is missing in param')
      }
      if (!DESTINATION_ID.includes(destinationId)) {
        throw new BadRequestException('destinationId is invalid, Please use valid destinationId')
      }
      return this.FtpOutboundService.checkFileDeliveryStatus(destinationId, fileName)
    } catch (error) {
      this.logger.error(
        'Error while checking the delivery status of filefrom remote server',
        error?.stack,
        error?.message,
      )
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message,
        },
        error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('destinations/:destinationId/remote-files')
  async listRemoteFiles(@Param('destinationId') destinationId: string) {
    try {
      this.logger.log('Received Requestbody in listRemoteFiles endpoint ', destinationId)
      if (!destinationId) {
        throw new BadRequestException('destinationId is required in params')
      }
      if (!DESTINATION_ID.includes(destinationId)) {
        throw new BadRequestException('Destination id is invalid')
      }
      return await this.FtpOutboundService.listRemoteFiles(destinationId)
    } catch (error) {
      this.logger.error(
        'Error while listing the files from remote server',
        error?.stack,
        error?.message,
      )
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message,
        },
        error?.status || error?.code || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('destinations/:destinationId/remote/inbound/files/:fileName')
  async downloadRemoteFile(
    @Param('destinationId') destinationId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    try {
      if (!destinationId || !fileName) {
        throw new BadRequestException('destinationId and fileName are required')
      }
      const { filePath } = await this.FtpOutboundService.downloadRemoteFile(
        destinationId,
        fileName,
      )

      const stream = fs.createReadStream(filePath)

      stream.pipe(res)

      stream.on('close', async () => {
        await fs.promises.unlink(filePath)
      })
      // return res.download(filePath, decryptedFileName)
    } catch (error) {
      this.logger.error('Error in downloadFile API', error?.stack, error?.message)

      // Keep your standard response structure
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message || 'Download failed',
        },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('destinations/:destinationId/local/inbound/files/:fileName')
  async downloadLocalFile(
    @Param('destinationId') destinationId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    try {
      if (!destinationId || !fileName) {
        throw new BadRequestException('destinationId and fileName are required')
      }
      const { filePath } = await this.FtpOutboundService.downloadLocalFile(
        destinationId,
        fileName,
      )

      const stream = fs.createReadStream(filePath)

      stream.pipe(res)

      stream.on('close', async () => {
        await fs.promises.unlink(filePath)
      })
      // return res.download(filePath, remoteFileName)
    } catch (error) {
      this.logger.error('Error in downloadLocalFile API', error?.stack, error?.message)

      // Keep your standard response structure
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message || 'Download failed',
        },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('destinations/:destinationId/health')
  async ftpHealthCheck(@Param('destinationId') destinationId: string) {
    try {
      this.logger.log('Received destinationId in ftp health check', destinationId)
      return this.FtpOutboundService.ftpHealthCheck()
    } catch (error) {
      this.logger.error('Error in ftp healthe check API', error?.stack, error?.message)

      // Keep your standard response structure
      throw new HttpException(
        {
          status: RESPONSE_STATUS.UNHEALTHY,
          statusCode: error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message || 'FTP server is not reachable',
        },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('destinations/:destinationId/local-files')
  listAllLocalFiles(@Param('destinationId') destinationId: string) {
    try {
      if (!destinationId) {
        throw new BadRequestException('destinationId is required')
      }
      if (!DESTINATION_ID.includes(destinationId)) {
        throw new BadRequestException('Destination id is invalid')
      }

      return this.FtpOutboundService.listAllLocalFiles(destinationId)
    } catch (error) {
      this.logger.error('Error in list All Local Files API', error?.stack, error?.message)

      // Keep your standard response structure
      throw new HttpException(
        {
          status: RESPONSE_STATUS.FAILED,
          statusCode: error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error?.message || 'Internal Server Error',
        },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}

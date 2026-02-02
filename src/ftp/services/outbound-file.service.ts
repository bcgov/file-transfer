import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import { UploadFileInterface } from '../interfaces/outbound.interface'
import { SERVER_CONFIG } from 'src/configs/server.config'

const { LOCAL_STORAGE_DIR, INBOUND_DIR, OUTBOUND_DIR } = SERVER_CONFIG

const { RESPONSE_STATUS, LOCAL_DIRECTORY } = COMMON_CONSTANT

@Injectable()
export class FtpOutboundService {
  private readonly logger = new Logger(FtpOutboundService.name)

  constructor(private readonly ftpClientService: FtpClientService) {}

  async uploadFileToCra(request: UploadFileInterface) {
    const { file, destinationId, fileName } = request
    this.logger.log(
      `Received file in Outbound Service: ${file.originalname} as ${fileName} to destination ${destinationId}`,
    )
    // encrypt file buffer in memory before saving to disk or uploading

    const tempDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.temp)
    const sentDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)

    // Ensure directories exist
    ;[tempDirPath, sentDirPath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
    const tempFilePath = path.join(tempDirPath, file.originalname)
    const sentFilePath = path.join(sentDirPath, file.originalname)

    // fs.mkdirSync(path.dirname(localFilePath), { recursive: true })
    fs.writeFileSync(tempFilePath, file.buffer)
    if (fs.existsSync(sentFilePath)) {
      this.logger.log(`Temporary file created at ${tempFilePath}`)
      return {
        statusCode: 201,
        status: RESPONSE_STATUS.SUCCESS,
        message: 'File already uploded to the destination server',
        fileName: file.originalname,
        destinationId: destinationId,
      }
      // return { status: RESPONSE_STATUS.FAILED, statusCode: 409, message: `File ${file.originalname} has already been sent. Duplicate files are not allowed.` }
    }

    const craFtpResponse = await this.ftpClientService.uploadFile(
      tempFilePath,
      OUTBOUND_DIR,
      file.originalname,
    )
    this.logger.log(`CRA FTP Response: ${JSON.stringify(craFtpResponse)}`)
    if (craFtpResponse?.code === 226) {
      fs.renameSync(tempFilePath, path.join(sentDirPath, file.originalname))
      return {
        statusCode: craFtpResponse?.code,
        status: RESPONSE_STATUS.SUCCESS,
        message: craFtpResponse?.message,
        fileName: file.originalname,
        destinationId: destinationId,
      }
    } else {
      fs.unlinkSync(tempFilePath) // delete temp file on failure
      throw new Error(`Failed to upload file to CRA FTP server: ${craFtpResponse?.message}`)
    }
  }

  async checkFileDeliveryStatus(destinationId: string, fileName: string) {
    const localSentFilePath = path.join(
      LOCAL_STORAGE_DIR,
      destinationId,
      LOCAL_DIRECTORY.outbound,
      fileName,
    )
    const localTepmFilePath = path.join(
      LOCAL_STORAGE_DIR,
      destinationId,
      LOCAL_DIRECTORY.temp,
      fileName,
    )
    if (fs.existsSync(localSentFilePath)) {
      return {
        status: RESPONSE_STATUS.SUCCESS,
        statusCode: 200,
        messge: 'File Delivered Successfuly to the Destination',
      }
    } else {
      const isFileExistOnRemote = await this.ftpClientService.checkFileExist(OUTBOUND_DIR, fileName)

      this.logger.log(`File ${fileName} Exist on Remote`, isFileExistOnRemote)
      if (!isFileExistOnRemote) {
        return { status: RESPONSE_STATUS.FAILED, statusCode: 404, message: 'File not Found' }
      }
      if (fs.existsSync(localTepmFilePath)) {
        this.logger.log(`File ${fileName} has been move from temp to sent Directory`)
        fs.renameSync(localTepmFilePath, localSentFilePath)
      }
      return {
        status: RESPONSE_STATUS.SUCCESS,
        statusCode: 200,
        message: 'File Delivered successfuly to the Destination',
      }
    }
  }

  async listFiles(destinationId: string) {
    const files = await this.ftpClientService.listFiles(INBOUND_DIR)
    const result = files.map((eachFile) => {
      return {
        fileName: eachFile.name,
        size: eachFile.size,
        lastModifiedAt: eachFile.rawModifiedAt,
      }
    })

    return {
      status: RESPONSE_STATUS.SUCCESS,
      statusCode: 200,
      destinationId,
      files: result,
    }
  }

  async downloadFileFromLocalOrFtp(destinationId: string, fileName: string) {
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const localOutbounDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)
    const localInboundFilePath = `${localInboundDir}/${fileName}`
    const localOutbounFilePath = `${localOutbounDir}/${fileName}`
    const remoteFilePath = `${INBOUND_DIR}/${fileName}`

    if (!fs.existsSync(localInboundDir)) {
      fs.mkdirSync(localInboundDir)
    }
    if (fs.existsSync(localOutbounFilePath)) {
      return { filePath: localOutbounFilePath, remoteFileName: fileName }
    }
    const isFileDownloadable = await this.ftpClientService.downloadSingleFile(
      remoteFilePath,
      localInboundFilePath,
    )

    if (!isFileDownloadable) {
      throw new NotFoundException(`File not Found: ${fileName}`)
    }

    // After download, verify it exists
    if (!fs.existsSync(localInboundFilePath)) {
      throw new NotFoundException(
        `Downloaded file not found locally after FTP download: ${fileName}`,
      )
    }

    return { filePath: localInboundFilePath, remoteFileName: fileName }
  }

  async ftpHealthCheck() {
    const files = await this.ftpClientService.listFiles(INBOUND_DIR)
    if (files?.length > 0) {
      return { status: RESPONSE_STATUS.HEALTHY, statusCode: 200, message: 'Ftp Server is Healthy' }
    } else {
      return {
        status: RESPONSE_STATUS.UNHEALTHY,
        statusCode: 503,
        message: 'Ftp Server is not reachable',
      }
    }
  }

  listAllLocalFiles(destinationId: string) {
    const localInboundPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)

    const localOutboundPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)

    const outboundFiles = this.readFiles(localOutboundPath, 'deliveredAt')
    const inboundFiles = this.readFiles(localInboundPath, 'downloadedAt')

    return {
      status: RESPONSE_STATUS.SUCCESS,
      destinationId,
      outbound: outboundFiles,
      inbound: inboundFiles,
    }
  }

  readFiles(dirPath: string, dateKey: string) {
    if (!fs.existsSync(dirPath)) {
      return []
    }

    return fs
      .readdirSync(dirPath)
      .map((fileName) => {
        const fullPath = path.join(dirPath, fileName)
        const stats = fs.statSync(fullPath)

        if (!stats.isFile()) {
          return null
        }

        return {
          fileName,
          size: stats.size,
          [dateKey]: stats.mtime.toISOString(),
        }
      })
      .filter(Boolean)
  }
}

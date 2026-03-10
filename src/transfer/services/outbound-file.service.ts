import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { spawn } from 'child_process'
import { S3ClientService } from './s3-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import { UploadFileInterface } from '../interfaces/outbound.interface'
import { SERVER_CONFIG } from 'src/configs/server.config'

const { LOCAL_STORAGE_DIR, CRA_PUB_CERT_PATH, CRA_PRIVATE_KEY_PATH } = SERVER_CONFIG

const { RESPONSE_STATUS, LOCAL_DIRECTORY } = COMMON_CONSTANT

@Injectable()
export class TransferOutboundService {
  private readonly logger = new Logger(TransferOutboundService.name)

  constructor(private readonly s3ClientService: S3ClientService) {}

  async uploadFile(request: UploadFileInterface) {
    const { file, destinationId, fileName } = request
    this.logger.log(
      `Received file in Outbound Service: ${file.originalname} as ${fileName} to destination ${destinationId}`,
    )
    const tempDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.temp)
    const outboundDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)

    ;[tempDirPath, outboundDirPath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })

    let uploadFileName: string
    let uploadBuffer: Buffer

    if (SERVER_CONFIG.encryptionEnabled) {
      const tempFilePath = path.join(tempDirPath, `${file.originalname}.p7m`)
      uploadFileName = await this.encryptBuffer(file.buffer, tempFilePath)
      this.logger.log(`File: ${fileName} encrypted successfully`)
      uploadBuffer = fs.readFileSync(tempFilePath)

      const outboundFilePath = path.join(outboundDirPath, uploadFileName)
      if (fs.existsSync(outboundFilePath)) {
        this.logger.log(`File ${uploadFileName} already uploaded, skipping`)
        return {
          statusCode: 201,
          status: RESPONSE_STATUS.SUCCESS,
          message: 'File already uploaded to the destination server',
          fileName: uploadFileName,
          destinationId,
        }
      }

      await this.s3ClientService.uploadFile(destinationId, 'OUTBOUND', uploadFileName, uploadBuffer)
      fs.renameSync(tempFilePath, path.join(outboundDirPath, uploadFileName))
    } else {
      uploadFileName = file.originalname
      uploadBuffer = file.buffer

      const outboundFilePath = path.join(outboundDirPath, uploadFileName)
      if (fs.existsSync(outboundFilePath)) {
        this.logger.log(`File ${uploadFileName} already uploaded, skipping`)
        return {
          statusCode: 201,
          status: RESPONSE_STATUS.SUCCESS,
          message: 'File already uploaded to the destination server',
          fileName: uploadFileName,
          destinationId,
        }
      }

      await this.s3ClientService.uploadFile(destinationId, 'OUTBOUND', uploadFileName, uploadBuffer)
      fs.writeFileSync(outboundFilePath, uploadBuffer)
    }

    this.logger.log(`S3 upload complete for file: ${uploadFileName}`)
    return {
      statusCode: 200,
      status: RESPONSE_STATUS.SUCCESS,
      message: 'File uploaded successfully to S3',
      fileName: uploadFileName,
      destinationId,
    }
  }

  async checkFileDeliveryStatus(destinationId: string, fileName: string) {
    const localOutboundFilePath = path.join(
      LOCAL_STORAGE_DIR,
      destinationId,
      LOCAL_DIRECTORY.outbound,
      fileName,
    )
    const localTempFilePath = path.join(
      LOCAL_STORAGE_DIR,
      destinationId,
      LOCAL_DIRECTORY.temp,
      fileName,
    )

    const isFileOnRemote = await this.s3ClientService.fileExists(
      destinationId,
      'OUTBOUND',
      fileName,
    )

    if (
      !isFileOnRemote &&
      !fs.existsSync(localOutboundFilePath) &&
      !fs.existsSync(localTempFilePath)
    ) {
      return { status: RESPONSE_STATUS.FAILED, message: 'File not found' }
    }

    if (isFileOnRemote && fs.existsSync(localOutboundFilePath)) {
      return { status: RESPONSE_STATUS.SUCCESS, message: 'File delivered successfully' }
    }

    if (isFileOnRemote && fs.existsSync(localTempFilePath)) {
      fs.renameSync(localTempFilePath, localOutboundFilePath)
      return { status: RESPONSE_STATUS.SUCCESS, message: 'File delivered successfully' }
    }

    return { status: RESPONSE_STATUS.SUCCESS, message: 'File is pending delivery' }
  }

  listOutboundFiles(destinationId: string) {
    const localOutboundPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)
    return {
      status: RESPONSE_STATUS.SUCCESS,
      destinationId,
      files: this.readFiles(localOutboundPath, 'deliveredAt'),
    }
  }

  async listInboundFiles(destinationId: string) {
    const files = await this.s3ClientService.listFiles(destinationId, 'INBOUND')
    return {
      status: RESPONSE_STATUS.SUCCESS,
      destinationId,
      files: files.map((file) => ({
        fileName: file.name,
        size: file.size,
        lastModifiedAt: file.lastModified,
      })),
    }
  }

  async downloadFile(destinationId: string, fileName: string) {
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const localFilePath = path.join(localInboundDir, fileName)

    if (!fs.existsSync(localInboundDir)) {
      fs.mkdirSync(localInboundDir, { recursive: true })
    }

    const tmpPath = localFilePath + '.downloading'
    try {
      const stream = await this.s3ClientService.downloadFile(destinationId, 'INBOUND', fileName)
      await this.streamToFile(stream, tmpPath)
      fs.renameSync(tmpPath, localFilePath)
    } catch (error) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      if (!fs.existsSync(localFilePath)) {
        throw new NotFoundException(`File not found: ${fileName}`)
      }
      this.logger.warn(
        `S3 download failed for ${fileName}, using local cache. Error: ${error.message}`,
      )
    }

    if (SERVER_CONFIG.encryptionEnabled && fileName.endsWith('.p7m')) {
      const decryptedFileName = fileName.replace(/\.p7m$/, '')
      const decryptedFilePath = path.join(localInboundDir, decryptedFileName)
      await this.decryptFile(localFilePath, decryptedFilePath)
      this.logger.log(`File ${fileName} decrypted as ${decryptedFileName}`)
      return { filePath: decryptedFilePath, fileName: decryptedFileName }
    }

    return { filePath: localFilePath, fileName }
  }

  async storageHealthCheck() {
    const isHealthy = await this.s3ClientService.healthCheck()
    if (isHealthy) {
      return { status: RESPONSE_STATUS.SUCCESS, statusCode: 200, message: 'S3 storage is healthy' }
    } else {
      return {
        status: RESPONSE_STATUS.FAILED,
        statusCode: 503,
        message: 'S3 storage is not reachable',
      }
    }
  }

  private readFiles(dirPath: string, dateKey: string) {
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

  private streamToFile(stream: Readable, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath)
      stream.pipe(writeStream)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })
  }

  private encryptBuffer(buffer: Buffer, outputPath: string): Promise<string> {
    this.logger.log(`Encrypting file buffer start & stored path: ${outputPath}`)

    return new Promise((resolve, reject) => {
      const openssl = spawn('openssl', [
        'cms',
        '-encrypt',
        '-binary',
        '-aes256',
        '-out',
        outputPath,
        '-outform',
        'DER',
        CRA_PUB_CERT_PATH,
      ])

      openssl.stdin.write(buffer)
      openssl.stdin.end()

      openssl.stderr.on('data', (data) => {
        this.logger.error(`OpenSSL error: ${data}`)
      })

      openssl.on('close', (code) => {
        if (code === 0) {
          resolve(path.basename(outputPath))
        } else {
          reject(new Error(`OpenSSL exited with code ${code}`))
        }
      })
    })
  }

  private decryptFile(inputFilePath: string, outputFilePath: string): Promise<string> {
    this.logger.log(
      `File decryption started inputFile: ${inputFilePath} outputFile: ${outputFilePath} privateKey: ${CRA_PRIVATE_KEY_PATH}`,
    )

    return new Promise((resolve, reject) => {
      const openssl = spawn('openssl', [
        'smime',
        '-decrypt',
        '-binary',
        '-inform',
        'DER',
        '-in',
        inputFilePath,
        '-inkey',
        CRA_PRIVATE_KEY_PATH,
        '-out',
        outputFilePath,
      ])

      openssl.stderr.on('data', (data) => {
        this.logger.error(`OpenSSL error: ${data}`)
      })

      openssl.on('close', (code) => {
        if (code === 0) {
          resolve(outputFilePath)
        } else {
          reject(new Error(`OpenSSL exited with code ${code}`))
        }
      })
    })
  }
}

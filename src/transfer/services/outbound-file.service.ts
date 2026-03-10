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
    const tempFilePath = path.join(tempDirPath, `${file.originalname}.p7m`)

    const encryptedFileName = await this.encryptBuffer(file.buffer, tempFilePath)
    this.logger.log(`File: ${fileName} encrypted successfully`)
    const outboundFilePath = path.join(outboundDirPath, encryptedFileName)
    if (fs.existsSync(outboundFilePath)) {
      this.logger.log(
        `File ${encryptedFileName} already uploaded to destination server, local outbound Path: ${outboundDirPath}, skipping upload.`,
      )
      this.logger.log(`File: ${fileName} already uploaded to the destination server`)
      return {
        statusCode: 201,
        status: RESPONSE_STATUS.SUCCESS,
        message: 'File already uploaded to the destination server',
        fileName: encryptedFileName,
        destinationId: destinationId,
      }
    }

    const encryptedBuffer = fs.readFileSync(tempFilePath)
    await this.s3ClientService.uploadFile(
      destinationId,
      'OUTBOUND',
      encryptedFileName,
      encryptedBuffer,
    )
    this.logger.log(`S3 upload complete for file: ${encryptedFileName}`)

    fs.renameSync(tempFilePath, path.join(outboundDirPath, encryptedFileName))
    return {
      statusCode: 200,
      status: RESPONSE_STATUS.SUCCESS,
      message: 'File uploaded successfully to S3',
      fileName: encryptedFileName,
      destinationId: destinationId,
    }
  }

  async checkFileDeliveryStatus(destinationId: string, fileName: string) {
    const localOutboundFilePath = path.join(
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
    let localDeliveryStatus = false
    if (fs.existsSync(localOutboundFilePath)) {
      localDeliveryStatus = true
    }
    const isFileExistOnRemote = await this.s3ClientService.fileExists(
      destinationId,
      'OUTBOUND',
      fileName,
    )

    if (!isFileExistOnRemote) {
      this.logger.log(`File ${fileName} not found on remote`, isFileExistOnRemote)
      return {
        status: RESPONSE_STATUS.FAILED,
        statusCode: 404,
        message: 'File not Found',
        local: localDeliveryStatus ? 'Delivered' : 'Not Delivered',
        remote: isFileExistOnRemote ? 'Delivered' : 'Not Delivered',
      }
    }
    if (fs.existsSync(localTepmFilePath)) {
      this.logger.log(`File ${fileName} has been moved from temp to outbound directory`)
      fs.renameSync(localTepmFilePath, localOutboundFilePath)
    }

    this.logger.log(
      `File ${fileName} Delivery Status local: ${localDeliveryStatus}, remote status: ${isFileExistOnRemote}`,
    )
    return {
      status: RESPONSE_STATUS.SUCCESS,
      statusCode: 200,
      message: 'File delivered successfully to the destination',
      local: localDeliveryStatus ? 'Delivered' : 'Not Delivered',
      remote: isFileExistOnRemote ? 'Delivered' : 'Not Delivered',
    }
  }

  async listRemoteFiles(destinationId: string) {
    const files = await this.s3ClientService.listFiles(destinationId, 'INBOUND')
    const result = files.map((eachFile) => {
      return {
        fileName: eachFile.name,
        size: eachFile.size,
        lastModifiedAt: eachFile.lastModified,
      }
    })

    return {
      status: RESPONSE_STATUS.SUCCESS,
      statusCode: 200,
      destinationId,
      files: result,
    }
  }

  async downloadRemoteFile(destinationId: string, fileName: string) {
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const localInboundFilePath = path.join(localInboundDir, fileName)

    if (!fs.existsSync(localInboundDir)) {
      fs.mkdirSync(localInboundDir, { recursive: true })
    }

    try {
      const stream = await this.s3ClientService.downloadFile(destinationId, 'INBOUND', fileName)
      await this.streamToFile(stream, localInboundFilePath)
    } catch {
      throw new NotFoundException(`File not Found: ${fileName}`)
    }

    const decryptedFileName = fileName.replace(/\.p7m$/, '')
    const decryptedFilePath = path.join(localInboundDir, decryptedFileName)

    await this.decryptFile(localInboundFilePath, decryptedFilePath)

    this.logger.log(`File ${fileName} downloaded and decrypted as ${decryptedFileName}`)

    return { filePath: decryptedFilePath, decryptedFileName: decryptedFileName }
  }

  async downloadLocalFile(destinationId: string, fileName: string) {
    this.logger.log(`Received Request for local file ${fileName} download`)
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const decryptedFileName = fileName.replace(/\.p7m$/, '')
    const localInboundFilePath = path.join(localInboundDir, fileName)
    const decryptedFilePath = path.join(localInboundDir, decryptedFileName)

    if (!fs.existsSync(localInboundFilePath)) {
      throw new NotFoundException(`Downloaded file not found locally: ${fileName}`)
    }
    await this.decryptFile(localInboundFilePath, decryptedFilePath)
    this.logger.log(`Local File ${fileName} Decrypted successfully`)

    this.logger.log(`Local file ${fileName} downloaded successfully`)

    return { filePath: decryptedFilePath, decryptedFileName: decryptedFileName }
  }

  async storageHealthCheck() {
    const isHealthy = await this.s3ClientService.healthCheck()
    if (isHealthy) {
      return { status: RESPONSE_STATUS.HEALTHY, statusCode: 200, message: 'S3 storage is healthy' }
    } else {
      return {
        status: RESPONSE_STATUS.UNHEALTHY,
        statusCode: 503,
        message: 'S3 storage is not reachable',
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
      `File Decrytion started inputfile: ${inputFilePath} outputFile: ${outputFilePath} private key: ${CRA_PRIVATE_KEY_PATH}`,
    )

    return new Promise((resolve, reject) => {
      const openssl = spawn('openssl', [
        'smime',
        '-decrypt',
        '-binary', // IMPORTANT for CRA files
        '-inform',
        'DER', // Your file is DER
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

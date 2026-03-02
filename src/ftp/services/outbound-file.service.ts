import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import { UploadFileInterface } from '../interfaces/outbound.interface'
import { SERVER_CONFIG } from 'src/configs/server.config'

const { LOCAL_STORAGE_DIR, INBOUND_DIR, OUTBOUND_DIR, CRA_PUB_CERT_PATH, CRA_PRIVATE_KEY_PATH } = SERVER_CONFIG

const { RESPONSE_STATUS, LOCAL_DIRECTORY } = COMMON_CONSTANT

@Injectable()
export class FtpOutboundService {
  private readonly logger = new Logger(FtpOutboundService.name)

  constructor(private readonly ftpClientService: FtpClientService) { }

  async uploadFileToCra(request: UploadFileInterface) {
    const { file, destinationId, fileName } = request
    this.logger.log(
      `Received file in Outbound Service: ${file.originalname} as ${fileName} to destination ${destinationId}`,
    )
    // encrypt file buffer in memory before saving to disk or uploading

    const tempDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.temp)
    const outboundDirPath = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.outbound)

      // Ensure directories exist
      ;[tempDirPath, outboundDirPath].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
      })
    const tempFilePath = path.join(tempDirPath, `${file.originalname}.p7m`)

    // fs.mkdirSync(path.dirname(localFilePath), { recursive: true })
    const encryptedFileName = await this.encryptBuffer(file.buffer, tempFilePath)
    const outboundFilePath = path.join(outboundDirPath, encryptedFileName)
    // fs.writeFileSync(tempFilePath, file.buffer)
    if (fs.existsSync(outboundFilePath)) {
      this.logger.log(
        `File ${encryptedFileName} already uploaded to destination server, local outbound Path: ${outboundDirPath}, skipping upload.`,
      )
      return {
        statusCode: 201,
        status: RESPONSE_STATUS.SUCCESS,
        message: 'File already uploded to the destination server',
        fileName: encryptedFileName,
        destinationId: destinationId,
      }
    }

    const craFtpResponse = await this.ftpClientService.uploadFile(
      tempFilePath,
      OUTBOUND_DIR,
      encryptedFileName,
    )
    this.logger.log(`CRA FTP Response: ${JSON.stringify(craFtpResponse)}`)
    if (craFtpResponse?.code === 226) {
      fs.renameSync(tempFilePath, path.join(outboundDirPath, encryptedFileName))
      return {
        statusCode: craFtpResponse?.code,
        status: RESPONSE_STATUS.SUCCESS,
        message: craFtpResponse?.message,
        fileName: encryptedFileName,
        destinationId: destinationId,
      }
    } else {
      fs.unlinkSync(tempFilePath) // delete temp file on failure
      throw new Error(`Failed to upload file to CRA FTP server: ${craFtpResponse?.message}`)
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
    const isFileExistOnRemote = await this.ftpClientService.checkFileExist(OUTBOUND_DIR, fileName)

    if (!isFileExistOnRemote) {
      this.logger.log(`File ${fileName} Not  Exist on Remote`, isFileExistOnRemote)
      return {
        status: RESPONSE_STATUS.FAILED,
        statusCode: 404,
        message: 'File not Found',
        local: localDeliveryStatus ? 'Delivered' : 'Not Delivered',
        remote: isFileExistOnRemote ? 'Delivered' : 'Not Delivered',
      }
    }
    if (fs.existsSync(localTepmFilePath)) {
      this.logger.log(`File ${fileName} has been move from temp to sent Directory`)
      fs.renameSync(localTepmFilePath, localOutboundFilePath)
    }

    this.logger.log('Local Delivery Status: ', localDeliveryStatus)
    return {
      status: RESPONSE_STATUS.SUCCESS,
      statusCode: 200,
      message: 'File Delivered successfuly to the Destination',
      local: localDeliveryStatus ? 'Delivered' : 'Not Delivered',
      remote: isFileExistOnRemote ? 'Delivered' : 'Not Delivered',
    }
  }

  async listRemoteFiles(destinationId: string) {
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

  async downloadRemoteFile(destinationId: string, fileName: string) {
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const localInboundFilePath = `${localInboundDir}/${fileName}`
    const remoteFilePath = `${INBOUND_DIR}/${fileName}`

    if (!fs.existsSync(localInboundDir)) {
      fs.mkdirSync(localInboundDir)
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
    const decryptedFileName = fileName.replace(/\.p7m$/, '')

    const decryptedFilePath = `${localInboundDir}/${decryptedFileName}`

    await this.decryptFile(localInboundFilePath, decryptedFilePath)

    this.logger.log(`The File ${fileName} downloded and stored at ${localInboundFilePath} & decrypted as ${decryptedFileName}`)

    return { filePath: decryptedFilePath, decryptedFileName: decryptedFileName }
  }

  async downloadLocalFile(destinationId: string, fileName: string) {
    this.logger.log(`Received Request for local file ${fileName} download`)
    const localInboundDir = path.join(LOCAL_STORAGE_DIR, destinationId, LOCAL_DIRECTORY.inbound)
    const decryptedFileName = fileName.replace(/\.p7m$/, '')
    const localInboundFilePath = `${localInboundDir}/${fileName}`
    const decryptedFilePath = `${localInboundDir}/${decryptedFileName}`

    if (!fs.existsSync(localInboundFilePath)) {
      throw new NotFoundException(`Downloaded file not found locally: ${fileName}`)
    }
    this.decryptFile(localInboundFilePath, decryptedFilePath)
    this.logger.log(`Local File ${fileName} Downloded successfully`)

    return { filePath: decryptedFilePath, decryptedFileName: decryptedFileName }
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

      // Send buffer to OpenSSL stdin
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

  private decryptFile(inputFilePath: string, outputFilePath: string) {

    return new Promise((resolve, reject) => {
      const openssl = spawn('openssl', [
        'smime',
        '-decrypt',
        '-binary',                 // IMPORTANT for CRA files
        '-inform', 'DER',          // Your file is DER
        '-in', inputFilePath,
        '-inkey', CRA_PRIVATE_KEY_PATH,
        '-out', outputFilePath
      ]);

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

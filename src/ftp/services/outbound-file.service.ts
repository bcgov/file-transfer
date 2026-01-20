import { Injectable, Logger, ConflictException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import { UploadFileInterface } from '../interfaces/outbound.interface'

const { local_inboundDir, local_outboundDir, cra_remoteDir, csa_remoteDir, RESPONSE_STATUS } =
  COMMON_CONSTANT

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

    const tempDirPath = path.join(local_outboundDir, `${destinationId}`, 'temp')
    const sentDirPath = path.join(local_outboundDir, `${destinationId}`, 'sent')

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
      throw new ConflictException(
        `File ${file.originalname} has already been sent. Duplicate files are not allowed.`,
      )
      // return { status: RESPONSE_STATUS.FAILED, statusCode: 409, message: `File ${file.originalname} has already been sent. Duplicate files are not allowed.` }
    }

    const craFtpResponse = await this.ftpClientService.uploadFile(
      tempFilePath,
      cra_remoteDir,
      file.originalname,
    )
    this.logger.log(`CRA FTP Response: ${JSON.stringify(craFtpResponse)}`)
    if (craFtpResponse?.code === 226) {
      fs.renameSync(tempFilePath, path.join(sentDirPath, file.originalname))
      return {
        statusCode: craFtpResponse?.code,
        status: RESPONSE_STATUS.DELIVERED,
        message: craFtpResponse?.message,
        fileName: file.originalname,
      }
    } else {
      fs.unlinkSync(tempFilePath) // delete temp file on failure
      throw new Error(`Failed to upload file to CRA FTP server: ${craFtpResponse?.message}`)
    }
  }

  async downloadFile() {
    return this.ftpClientService.downloadFile(local_inboundDir, csa_remoteDir)
  }
}

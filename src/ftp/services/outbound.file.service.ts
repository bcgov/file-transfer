import { Injectable, OnModuleInit } from '@nestjs/common'
import { Parser } from 'json2csv'
import * as fs from 'fs'
import * as path from 'path'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import { UploadFileInterface } from '../interfaces/outbound.interface'

const { local_inboundDir, local_outboundDir, cra_remoteDir, csa_remoteDir, RESPONSE_STATUS } =
  COMMON_CONSTANT

@Injectable()
export class FtpOutboundService implements OnModuleInit {
  constructor(private readonly ftpClientService: FtpClientService) {}
  async processAndUpload(dto: CreateFileDto) {
    const fileName = this.buildFileName(dto.system, dto.flow, dto.fileType)

    // const localDir = path.resolve(process.cwd(), local_outboundDir);
    const localDir = local_outboundDir
    console.log('Local Dir', localDir)
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir)
    }

    const localFilePath = path.join(localDir, fileName)

    // 1️⃣ Convert JSON to CSV
    const parser = new Parser()
    const csvData = parser.parse(dto.payload)

    // 2️⃣ Write CSV locally
    fs.writeFileSync(localFilePath, csvData)

    // 3️⃣ Upload to FTP
    // await this.uploadToFtp(localFilePath, fileName);
    //   await this.uploadToFtp(localFilePath, `/test/${fileName}`);

    console.log(
      `Uploading file from ${localFilePath} to FTP server... at Path============>${cra_remoteDir}/${fileName}`,
    )
    const res = await this.ftpClientService.uploadFile(localFilePath, cra_remoteDir, fileName)
    console.log('Response from ftp server', res)

    console.log('File uploded successfuly , fileName', fileName)

    return { fileName }
  }

  private buildFileName(system: string, flow: string, fileType: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14)

    const sequence = '001'

    return `${system}-${flow}-${fileType}-${timestamp}-${sequence}.csv`
  }

  onModuleInit() {
    // setInterval(async () => {
    //     console.log('Checking file is availabel or not')
    //     let result = await this.downloadFile()
    //     console.log('Poling Result', result)
    // }, 5000);
  }

  async uploadFileToCra(request: UploadFileInterface) {
    const { file, headers } = request
    const { servicename: serviceName, userid: userId } = headers
    console.log('uploadFileToCra service called', file, userId, serviceName)

    const localFilePath = path.join(local_outboundDir, 'temp', file.originalname)

    fs.mkdirSync(path.dirname(localFilePath), { recursive: true })
    fs.writeFileSync(localFilePath, file.buffer)

    const craFtpResponse = await this.ftpClientService.uploadFile(
      localFilePath,
      cra_remoteDir,
      file.originalname,
    )
    // fs.unlinkSync(localFilePath);
    console.log('CRA FTP Response', craFtpResponse)
    if (craFtpResponse?.code === 226) {
      return {
        statusCode: craFtpResponse?.code,
        status: RESPONSE_STATUS.DELIVERED,
        message: craFtpResponse?.message,
        fileName: file.originalname,
      }
    } else {
      throw new Error(`Failed to upload file to CRA FTP server: ${craFtpResponse?.message}`)
    }
  }

  async downloadFile() {
    return this.ftpClientService.downloadFile(local_inboundDir, csa_remoteDir)
  }
}

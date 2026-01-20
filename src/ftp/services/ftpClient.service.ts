import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'basic-ftp'
// import { ConfigService } from '@nestjs/config'
import path from 'path'
import fs from 'fs'

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env

@Injectable()
export class FtpClientService {
  private readonly logger = new Logger(FtpClientService.name)

  // constructor(private readonly configService: ConfigService) { }

  private async getClient(): Promise<Client> {
    const client = new Client()
    console.log('ftp host===================>', FTP_HOST, FTP_PORT, FTP_PASSWORD, FTP_USER)
    await client.access({
      // host: this.configService.get<string>('FTP_HOST')!,
      // port: Number(this.configService.get('FTP_PORT') || 21),
      // user: this.configService.get<string>('FTP_USER')!,
      // password: this.configService.get<string>('FTP_PASSWORD')!,
      host: FTP_HOST,
      port: Number(FTP_PORT || 21),
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    })

    return client
  }

  async uploadFile(localFilePath: string, remoteDir: string, remoteFileName: string) {
    console.log('uploadFile ftp clent', localFilePath, remoteDir, remoteFileName)
    const client = await this.getClient()

    await client.ensureDir(remoteDir)
    const tempPath = `${remoteDir}/${remoteFileName}.tmp`
    const finalPath = `${remoteDir}/${remoteFileName}`

    const result = await client.uploadFrom(localFilePath, tempPath)
    console.log('File Upload Response', result)
    await client.rename(tempPath, finalPath)
    this.logger.log(`Uploded FileName: ${remoteFileName}`)
    return result
  }

  // this.logger.log('Host', this.configService.get<string>('FTP_HOST'));

  async downloadFile(local_inboundDir: string, cra_remoteDir: string) {
    const client = await this.getClient()

    // const localDir = path.join(process.cwd(), local_inboundDir)
    const localDir = local_inboundDir
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir)
    }
    const files = await client.list(cra_remoteDir)
    for (const file of files) {
      console.log('File from ftp', file)
      console.log('Local Dir for download=========------->', cra_remoteDir, file.name, localDir)
      if (file.isDirectory || file.name.split('.').pop() === 'tmp') continue
      const localFilePath = path.join(localDir, file.name)
      const remoteFilePath = `${cra_remoteDir}/${file.name}`
      // const processedPath = `${cra_remoteDir}/processed/${file.name}`
      const processedPath = `${cra_remoteDir}/${file.name}`
      const result = await client.downloadTo(localFilePath, remoteFilePath)
      // await client.ensureDir(`${cra_remoteDir}/processed`)
      const moveResult = await client.rename(remoteFilePath, processedPath)
      console.log('download Result', result, file.name, 'move REsult', moveResult)
    }

    return { statusCode: 200, message: 'File downloded successfuly' }
  }
}

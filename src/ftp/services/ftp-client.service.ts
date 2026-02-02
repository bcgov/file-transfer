import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'basic-ftp'

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env

@Injectable()
export class FtpClientService {
  private readonly logger = new Logger(FtpClientService.name)

  // constructor(private readonly configService: ConfigService) { }

  private async getClient(): Promise<Client> {
    const client = new Client()
    await client.access({
      host: FTP_HOST,
      port: Number(FTP_PORT || 21),
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    })

    return client
  }

  async uploadFile(localFilePath: string, remoteDir: string, remoteFileName: string) {
    const client = await this.getClient()

    await client.ensureDir(remoteDir)
    const tempPath = `${remoteDir}/${remoteFileName}.tmp`
    const finalPath = `${remoteDir}/${remoteFileName}`

    const result = await client.uploadFrom(localFilePath, tempPath)
    await client.rename(tempPath, finalPath)
    this.logger.log(`Uploded: ${remoteFileName} to remote server`)
    client.close()
    return result
  }
  async checkFileExist(cra_remoteDir: string, fileName: string) {
    const client = await this.getClient()

    try {
      const files = await client.list(cra_remoteDir)
      return files.some((eachFile) => eachFile.name === fileName)
    } catch (error) {
      this.logger.error('Error while checking File Exist on Remote Server', error)
      return false
    } finally {
      client.close()
    }
  }

  // this.logger.log('Host', this.configService.get<string>('FTP_HOST'));

  async listFiles(remotePath: string) {
    try {
      const client = await this.getClient()
      return await client.list(remotePath)
    } catch (error) {
      this.logger.error('Got Error while listing the files', error?.stack)
      throw new Error('Error while listing the file', error?.message)
      // return []
    }
  }

  async downloadSingleFile(remoteFilePath: string, localFilePath: string) {
    try {
      const client = await this.getClient()
      this.logger.log(`Downloading from FTP: ${remoteFilePath} -> ${localFilePath}`)
      await client.downloadTo(localFilePath, remoteFilePath)
      return localFilePath
    } catch (error) {
      this.logger.error('Error while downloading file', error)
      return false
    }
  }
}

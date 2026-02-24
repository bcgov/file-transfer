import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'basic-ftp'
import { FTP_CONSTANT } from '../ftp.constant'

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env

@Injectable()
export class FtpClientService {
  private readonly logger = new Logger(FtpClientService.name)

  private async getClient(): Promise<Client> {
    if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
      throw new Error('FTP environment variables are not properly set')
    }

    // 30s timeout is important for OpenShift
    const client = new Client(FTP_CONSTANT.FTP_TIMEOUT)
    client.ftp.verbose = true

    await client.access({
      host: FTP_HOST,
      port: Number(FTP_PORT ?? 21),
      user: FTP_USER,
      password: FTP_PASSWORD, // DO NOT encode
      secure: false, // change to true if FTPS is required
    })

    return client
  }

  async uploadFile(localFilePath: string, remoteDir: string, remoteFileName: string) {
    const client = await this.getClient()

    try {
      // Only keep ensureDir if CRA allows directory creation
      await client.ensureDir(remoteDir)

      // const tempPath = `${remoteDir}/${remoteFileName}.tmp`
      const finalPath = `${remoteDir}/${remoteFileName}`

      // const result = await client.uploadFrom(localFilePath, tempPath)
      // await client.rename(tempPath, finalPath)

      this.logger.log(`Uploaded file: ${finalPath}`)
      return { code: 226, message: 'File stored locally, Skipping upload to the CRA' }
      // return result
    } catch (error) {
      this.logger.error('Error while uploading file', error?.stack, error?.message)
      throw new Error(`FTP upload failed: ${error?.message || 'Unknown error'}`)
    } finally {
      client.close()
    }
  }

  async checkFileExist(remoteDir: string, fileName: string): Promise<boolean> {
    const client = await this.getClient()
    try {
      const files = await client.list(remoteDir)
      return files.some((file) => file.name === fileName)
    } catch (error) {
      this.logger.error('Error while checking file existence', error?.stack, error?.message)
      throw new Error(`FTP file existence check failed: ${error?.message || 'Unknown error'}`)
    } finally {
      client.close()
    }
  }

  async listFiles(remotePath: string) {
    const client = await this.getClient()

    try {
      return await client.list(remotePath)
    } catch (error) {
      this.logger.error('Error while listing files', error?.stack, error?.message)
      throw new Error(`Failed to list FTP files: ${error?.message || 'Unknown error'}`)
    } finally {
      client.close()
    }
  }

  async downloadSingleFile(remoteFilePath: string, localFilePath: string): Promise<string> {
    const client = await this.getClient()

    try {
      this.logger.log(`Downloading FTP file: ${remoteFilePath} -> ${localFilePath}`)
      await client.downloadTo(localFilePath, remoteFilePath)
      return localFilePath
    } catch (error) {
      this.logger.error('Error while downloading file', error?.stack, error?.message)
      return null
    } finally {
      client.close()
    }
  }
}

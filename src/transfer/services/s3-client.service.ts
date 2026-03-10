import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'minio'
import { S3_CONFIG } from '../../configs/s3.config'
import type { Readable } from 'stream'

@Injectable()
export class S3ClientService {
  private readonly logger = new Logger(S3ClientService.name)
  private readonly client: Client
  private readonly bucket: string
  private readonly prefix: string

  constructor() {
    this.client = new Client({
      endPoint: S3_CONFIG.endPoint,
      port: S3_CONFIG.port,
      useSSL: S3_CONFIG.useSSL,
      accessKey: S3_CONFIG.accessKey,
      secretKey: S3_CONFIG.secretKey,
    })
    this.bucket = S3_CONFIG.bucket
    this.prefix = S3_CONFIG.prefix
  }

  private buildKey(destinationId: string, direction: string, fileName: string): string {
    return `${this.prefix}${destinationId.toUpperCase()}/${direction}/${fileName}`
  }

  async uploadFile(destinationId: string, direction: string, fileName: string, buffer: Buffer) {
    const key = this.buildKey(destinationId, direction, fileName)
    this.logger.log(`Uploading to S3: ${key}`)
    const result = await this.client.putObject(this.bucket, key, buffer)
    this.logger.log(`Upload complete: ${key}`)
    return result
  }

  async downloadFile(
    destinationId: string,
    direction: string,
    fileName: string,
  ): Promise<Readable> {
    const key = this.buildKey(destinationId, direction, fileName)
    this.logger.log(`Downloading from S3: ${key}`)
    return await this.client.getObject(this.bucket, key)
  }

  async listFiles(
    destinationId: string,
    direction: string,
  ): Promise<{ name: string; size: number; lastModified: Date }[]> {
    const prefix = `${this.prefix}${destinationId.toUpperCase()}/${direction}/`
    this.logger.log(`Listing S3 objects with prefix: ${prefix}`)

    return new Promise((resolve, reject) => {
      const files: { name: string; size: number; lastModified: Date }[] = []
      const stream = this.client.listObjects(this.bucket, prefix, false)

      stream.on('data', (obj) => {
        if (obj.name) {
          files.push({
            name: obj.name.replace(prefix, ''),
            size: obj.size,
            lastModified: obj.lastModified,
          })
        }
      })
      stream.on('end', () => resolve(files))
      stream.on('error', (err) => reject(err))
    })
  }

  async fileExists(destinationId: string, direction: string, fileName: string): Promise<boolean> {
    const key = this.buildKey(destinationId, direction, fileName)
    try {
      await this.client.statObject(this.bucket, key)
      return true
    } catch (err: any) {
      if (err?.code === 'NotFound' || err?.code === 'NoSuchKey') {
        return false
      }
      throw err
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.bucket)
      return true
    } catch {
      return false
    }
  }
}

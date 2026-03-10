import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../configs/s3.config', () => ({
  S3_CONFIG: {
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'test-access-key',
    secretKey: 'test-secret-key',
    bucket: 'test-bucket',
    prefix: 'test-prefix/',
  },
}))

vi.mock('minio', () => {
  const mockClient = {
    putObject: vi.fn(),
    getObject: vi.fn(),
    listObjects: vi.fn(),
    statObject: vi.fn(),
    bucketExists: vi.fn(),
  }
  return {
    Client: vi.fn(function () {
      return mockClient
    }),
    __mockClient: mockClient,
  }
})

import { __mockClient as mockMinioClient } from 'minio'
import { S3ClientService } from './s3-client.service'

describe('S3ClientService', () => {
  let service: S3ClientService

  beforeEach(() => {
    service = new S3ClientService()
    vi.clearAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload buffer to S3 with correct key', async () => {
      ;(mockMinioClient.putObject as any).mockResolvedValue({ etag: '123' })

      const buffer = Buffer.from('encrypted-content')
      const result = await service.uploadFile('dest1', 'OUTBOUND', 'file.p7m', buffer)

      expect(mockMinioClient.putObject).toHaveBeenCalledOnce()
      expect(result).toHaveProperty('etag')
    })
  })

  describe('downloadFile', () => {
    it('should download file from S3 and return stream', async () => {
      const mockStream = { pipe: vi.fn() }
      ;(mockMinioClient.getObject as any).mockResolvedValue(mockStream)

      const result = await service.downloadFile('dest1', 'INBOUND', 'file.csv')

      expect(mockMinioClient.getObject).toHaveBeenCalledOnce()
      expect(result).toBe(mockStream)
    })
  })

  describe('listFiles', () => {
    it('should list files in S3 prefix', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback({
              name: 'prefix/dest1/INBOUND/file1.csv',
              size: 100,
              lastModified: new Date(),
            })
            callback({
              name: 'prefix/dest1/INBOUND/file2.csv',
              size: 200,
              lastModified: new Date(),
            })
          }
          if (event === 'end') {
            callback()
          }
          return mockStream
        }),
      }
      ;(mockMinioClient.listObjects as any).mockReturnValue(mockStream)

      const result = await service.listFiles('dest1', 'INBOUND')

      expect(mockMinioClient.listObjects).toHaveBeenCalledOnce()
      expect(result).toHaveLength(2)
    })
  })

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      ;(mockMinioClient.statObject as any).mockResolvedValue({ size: 100 })

      const result = await service.fileExists('dest1', 'OUTBOUND', 'file.p7m')

      expect(result).toBe(true)
    })

    it('should return false when file does not exist', async () => {
      ;(mockMinioClient.statObject as any).mockRejectedValue({ code: 'NotFound' })

      const result = await service.fileExists('dest1', 'OUTBOUND', 'file.p7m')

      expect(result).toBe(false)
    })
  })

  describe('healthCheck', () => {
    it('should return true when bucket is reachable', async () => {
      ;(mockMinioClient.bucketExists as any).mockResolvedValue(true)

      const result = await service.healthCheck()

      expect(result).toBe(true)
    })

    it('should return false when bucket is not reachable', async () => {
      ;(mockMinioClient.bucketExists as any).mockRejectedValue(new Error('Connection refused'))

      const result = await service.healthCheck()

      expect(result).toBe(false)
    })
  })
})

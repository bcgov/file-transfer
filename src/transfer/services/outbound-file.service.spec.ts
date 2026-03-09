import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { Readable } from 'stream'
import { EventEmitter } from 'events'

vi.mock('src/configs/server.config', () => ({
  SERVER_CONFIG: {
    LOCAL_STORAGE_DIR: '/tmp/test-storage',
    CRA_PUB_CERT_PATH: '/certs/test-cert.pem',
    CRA_PRIVATE_KEY_PATH: '/certs/test-key.pem',
  },
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    createWriteStream: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  createWriteStream: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('../../configs/s3.config', () => ({
  S3_CONFIG: {
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'test-key',
    secretKey: 'test-secret',
    bucket: 'test-bucket',
    prefix: 'test/',
  },
}))

import * as fs from 'fs'
import { spawn } from 'child_process'
import { TransferOutboundService } from './outbound-file.service'

describe('TransferOutboundService', () => {
  let service: TransferOutboundService
  let mockS3ClientService: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()

    mockS3ClientService = {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      fileExists: vi.fn(),
      listFiles: vi.fn(),
      healthCheck: vi.fn(),
    }

    service = new TransferOutboundService(mockS3ClientService as any)
  })

  describe('uploadFile', () => {
    it('should upload file to S3 and move to outbound folder', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('file content'),
      } as any

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('encrypted-content'))
      mockS3ClientService.uploadFile.mockResolvedValue({ etag: '123' })

      const mockStdin = new EventEmitter() as any
      mockStdin.write = vi.fn()
      mockStdin.end = vi.fn()
      const mockStderr = new EventEmitter()
      const mockProcess = new EventEmitter() as any
      mockProcess.stdin = mockStdin
      mockProcess.stderr = mockStderr
      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const uploadPromise = service.uploadFile({
        file: mockFile,
        destinationId: 'cra-ftp',
        fileName: 'test.txt',
      })

      mockProcess.emit('close', 0)

      const result = await uploadPromise

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.message).toBe('File uploaded successfully to S3')
      expect(result.destinationId).toBe('cra-ftp')
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2)
      expect(mockS3ClientService.uploadFile).toHaveBeenCalled()
      expect(fs.renameSync).toHaveBeenCalled()
    })

    it('should return already uploaded response when file exists in outbound', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('file content'),
      } as any

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)

      const mockStdin = new EventEmitter() as any
      mockStdin.write = vi.fn()
      mockStdin.end = vi.fn()
      const mockStderr = new EventEmitter()
      const mockProcess = new EventEmitter() as any
      mockProcess.stdin = mockStdin
      mockProcess.stderr = mockStderr
      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const uploadPromise = service.uploadFile({
        file: mockFile,
        destinationId: 'cra-ftp',
        fileName: 'test.txt',
      })

      mockProcess.emit('close', 0)

      const result = await uploadPromise

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(201)
      expect(result.message).toBe('File already uploaded to the destination server')
      expect(mockS3ClientService.uploadFile).not.toHaveBeenCalled()
    })
  })

  describe('checkFileDeliveryStatus', () => {
    it('should return FAILED when file exists locally but not on S3', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true)
      mockS3ClientService.fileExists.mockResolvedValue(false)

      const result = await service.checkFileDeliveryStatus('cra-ftp', 'test.txt')

      expect(result.status).toBe('FAILED')
      expect(result.statusCode).toBe(404)
      expect(result.local).toBe('Delivered')
      expect(result.remote).toBe('Not Delivered')
    })

    it('should return FAILED when not found locally and not on S3', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      mockS3ClientService.fileExists.mockResolvedValue(false)

      const result = await service.checkFileDeliveryStatus('cra-ftp', 'test.txt')

      expect(result.status).toBe('FAILED')
      expect(result.statusCode).toBe(404)
      expect(result.local).toBe('Not Delivered')
      expect(result.remote).toBe('Not Delivered')
    })

    it('should move file from temp to outbound and return SUCCESS when on S3', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true)

      mockS3ClientService.fileExists.mockResolvedValue(true)

      const result = await service.checkFileDeliveryStatus('cra-ftp', 'test.txt')

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.remote).toBe('Delivered')
      expect(fs.renameSync).toHaveBeenCalled()
    })

    it('should return SUCCESS when on S3 but temp file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)

      mockS3ClientService.fileExists.mockResolvedValue(true)

      const result = await service.checkFileDeliveryStatus('cra-ftp', 'test.txt')

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.local).toBe('Delivered')
      expect(result.remote).toBe('Delivered')
      expect(fs.renameSync).not.toHaveBeenCalled()
    })
  })

  describe('listRemoteFiles', () => {
    it('should list files from S3', async () => {
      const mockFiles = [
        { name: 'file1.txt', size: 100, lastModified: new Date('2025-01-01') },
        { name: 'file2.txt', size: 200, lastModified: new Date('2025-01-02') },
      ]
      mockS3ClientService.listFiles.mockResolvedValue(mockFiles)

      const result = await service.listRemoteFiles('cra-ftp')

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.destinationId).toBe('cra-ftp')
      expect(result.files).toHaveLength(2)
      expect(result.files[0]).toEqual({
        fileName: 'file1.txt',
        size: 100,
        lastModifiedAt: new Date('2025-01-01'),
      })
      expect(mockS3ClientService.listFiles).toHaveBeenCalledWith('cra-ftp', 'INBOUND')
    })

    it('should throw when S3 errors', async () => {
      mockS3ClientService.listFiles.mockRejectedValue(new Error('S3 connection failed'))

      await expect(service.listRemoteFiles('cra-ftp')).rejects.toThrow('S3 connection failed')
    })

    it('should return empty list when no files', async () => {
      mockS3ClientService.listFiles.mockResolvedValue([])

      const result = await service.listRemoteFiles('cra-ftp')

      expect(result.status).toBe('SUCCESS')
      expect(result.files).toHaveLength(0)
    })
  })

  describe('downloadRemoteFile', () => {
    it('should create inbound dir, download from S3, and decrypt', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true)

      const mockReadable = new Readable({
        read() {},
      })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)

      const mockDecryptStderr = new EventEmitter()
      const mockDecryptProcess = new EventEmitter() as any
      mockDecryptProcess.stderr = mockDecryptStderr
      vi.mocked(spawn).mockReturnValue(mockDecryptProcess as any)

      const downloadPromise = service.downloadRemoteFile('cra-ftp', 'report.csv.p7m')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })

      mockReadable.push('file-data')
      mockReadable.push(null)

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })
      mockDecryptProcess.emit('close', 0)

      const result = await downloadPromise

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('inbound'), {
        recursive: true,
      })
      expect(mockS3ClientService.downloadFile).toHaveBeenCalledWith(
        'cra-ftp',
        'INBOUND',
        'report.csv.p7m',
      )
      expect(result.filePath).toContain('report.csv')
      expect(result.decryptedFileName).toBe('report.csv')
    })

    it('should throw NotFoundException when S3 download fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      mockS3ClientService.downloadFile.mockRejectedValue(new Error('NoSuchKey'))

      await expect(service.downloadRemoteFile('cra-ftp', 'missing.csv')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('storageHealthCheck', () => {
    it('should return HEALTHY when S3 is reachable', async () => {
      mockS3ClientService.healthCheck.mockResolvedValue(true)

      const result = await service.storageHealthCheck()

      expect(result.status).toBe('HEALTHY')
      expect(result.statusCode).toBe(200)
      expect(result.message).toBe('S3 storage is healthy')
    })

    it('should return UNHEALTHY when S3 is not reachable', async () => {
      mockS3ClientService.healthCheck.mockResolvedValue(false)

      const result = await service.storageHealthCheck()

      expect(result.status).toBe('UNHEALTHY')
      expect(result.statusCode).toBe(503)
      expect(result.message).toBe('S3 storage is not reachable')
    })
  })

  describe('listAllLocalFiles', () => {
    it('should return file history from outbound and inbound dirs', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['file1.txt', 'file2.txt'] as any)
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date('2025-01-15T10:00:00Z'),
      } as any)

      const result = service.listAllLocalFiles('cra-ftp')

      expect(result.status).toBe('SUCCESS')
      expect(result.destinationId).toBe('cra-ftp')
      expect(result.outbound).toHaveLength(2)
      expect(result.inbound).toHaveLength(2)
      expect(result.outbound[0]).toEqual({
        fileName: 'file1.txt',
        size: 1024,
        deliveredAt: '2025-01-15T10:00:00.000Z',
      })
      expect(result.inbound[0]).toEqual({
        fileName: 'file1.txt',
        size: 1024,
        downloadedAt: '2025-01-15T10:00:00.000Z',
      })
    })

    it('should return empty arrays when directories do not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = service.listAllLocalFiles('cra-ftp')

      expect(result.status).toBe('SUCCESS')
      expect(result.outbound).toEqual([])
      expect(result.inbound).toEqual([])
    })
  })
})

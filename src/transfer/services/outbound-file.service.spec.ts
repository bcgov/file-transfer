import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { Readable } from 'stream'
import { EventEmitter } from 'events'

vi.mock('src/configs/server.config', () => ({
  SERVER_CONFIG: {
    LOCAL_STORAGE_DIR: '/tmp/test-storage',
    CRA_PUB_CERT_PATH: '/certs/test-cert.pem',
    CRA_PRIVATE_KEY_PATH: '/certs/test-key.pem',
    encryptionEnabled: true,
  },
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    createWriteStream: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
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
import { SERVER_CONFIG } from 'src/configs/server.config'
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
        destinationId: 'cra',
        fileName: 'test.txt',
      })

      mockProcess.emit('close', 0)

      const result = await uploadPromise

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.message).toBe('File uploaded successfully to S3')
      expect(result.destinationId).toBe('cra')
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
        destinationId: 'cra',
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

  describe('uploadFile (encryption OFF)', () => {
    beforeEach(() => {
      ;(SERVER_CONFIG as any).encryptionEnabled = false
    })
    afterEach(() => {
      ;(SERVER_CONFIG as any).encryptionEnabled = true
    })

    it('should upload file without encryption', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('file content'),
      } as any

      vi.mocked(fs.existsSync).mockReturnValue(false)
      mockS3ClientService.uploadFile.mockResolvedValue({ etag: '123' })

      const result = await service.uploadFile({
        file: mockFile,
        destinationId: 'cra',
        fileName: 'test.txt',
      })

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.fileName).toBe('test.txt')
      expect(spawn).not.toHaveBeenCalled()
      expect(mockS3ClientService.uploadFile).toHaveBeenCalledWith(
        'cra',
        'OUTBOUND',
        'test.txt',
        Buffer.from('file content'),
      )
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should return already uploaded when file exists in outbound', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('file content'),
      } as any

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // tempDir exists
        .mockReturnValueOnce(true) // outboundDir exists
        .mockReturnValueOnce(true) // outboundFilePath exists

      const result = await service.uploadFile({
        file: mockFile,
        destinationId: 'cra',
        fileName: 'test.txt',
      })

      expect(result.statusCode).toBe(201)
      expect(result.message).toBe('File already uploaded to the destination server')
      expect(mockS3ClientService.uploadFile).not.toHaveBeenCalled()
    })
  })

  describe('checkFileDeliveryStatus', () => {
    it('should return FAILED when file not on S3 and not local', async () => {
      mockS3ClientService.fileExists.mockResolvedValue(false)
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // outbound
        .mockReturnValueOnce(false) // temp

      const result = await service.checkFileDeliveryStatus('cra', 'test.txt')

      expect(result.status).toBe('FAILED')
      expect(result.message).toBe('File not found')
    })

    it('should return SUCCESS when file on S3 and in outbound', async () => {
      mockS3ClientService.fileExists.mockResolvedValue(true)
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // outbound

      const result = await service.checkFileDeliveryStatus('cra', 'test.txt')

      expect(result.status).toBe('SUCCESS')
      expect(result.message).toBe('File delivered successfully')
    })

    it('should move temp to outbound and return SUCCESS when on S3', async () => {
      mockS3ClientService.fileExists.mockResolvedValue(true)
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // outbound
        .mockReturnValueOnce(true) // temp

      const result = await service.checkFileDeliveryStatus('cra', 'test.txt')

      expect(result.status).toBe('SUCCESS')
      expect(fs.renameSync).toHaveBeenCalled()
    })

    it('should return SUCCESS with pending message when file local but not on S3', async () => {
      mockS3ClientService.fileExists.mockResolvedValue(false)
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // outbound exists

      const result = await service.checkFileDeliveryStatus('cra', 'test.txt')

      expect(result.status).toBe('SUCCESS')
      expect(result.message).toBe('File is pending delivery')
    })
  })

  describe('listInboundFiles', () => {
    it('should list files from S3', async () => {
      const mockFiles = [
        { name: 'file1.txt', size: 100, lastModified: new Date('2025-01-01') },
        { name: 'file2.txt', size: 200, lastModified: new Date('2025-01-02') },
      ]
      mockS3ClientService.listFiles.mockResolvedValue(mockFiles)

      const result = await service.listInboundFiles('cra')

      expect(result.status).toBe('SUCCESS')
      expect(result.destinationId).toBe('cra')
      expect(result.files).toHaveLength(2)
      expect(result.files[0]).toEqual({
        fileName: 'file1.txt',
        size: 100,
        lastModifiedAt: new Date('2025-01-01'),
      })
      expect(mockS3ClientService.listFiles).toHaveBeenCalledWith('cra', 'INBOUND')
    })

    it('should throw when S3 errors', async () => {
      mockS3ClientService.listFiles.mockRejectedValue(new Error('S3 connection failed'))
      await expect(service.listInboundFiles('cra')).rejects.toThrow('S3 connection failed')
    })

    it('should return empty list when no files', async () => {
      mockS3ClientService.listFiles.mockResolvedValue([])
      const result = await service.listInboundFiles('cra')
      expect(result.status).toBe('SUCCESS')
      expect(result.files).toHaveLength(0)
    })
  })

  describe('downloadFile', () => {
    afterEach(() => {
      ;(SERVER_CONFIG as any).encryptionEnabled = true
    })

    it('should always try S3 first and cache locally', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // inbound dir exists

      const mockReadable = new Readable({ read() {} })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      const downloadPromise = service.downloadFile('cra', 'report.csv')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })
      mockReadable.push('file-data')
      mockReadable.push(null)

      const result = await downloadPromise

      expect(mockS3ClientService.downloadFile).toHaveBeenCalledWith('cra', 'INBOUND', 'report.csv')
      expect(fs.renameSync).toHaveBeenCalled()
      expect(result.filePath).toContain('report.csv')
      expect(result.fileName).toBe('report.csv')
    })

    it('should overwrite local cache when S3 download succeeds', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // inbound dir exists

      const mockReadable = new Readable({ read() {} })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      const downloadPromise = service.downloadFile('cra', 'report.csv')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })
      mockReadable.push('fresh-s3-data')
      mockReadable.push(null)

      const result = await downloadPromise

      expect(mockS3ClientService.downloadFile).toHaveBeenCalled()
      expect(fs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining('report.csv.downloading'),
      )
      expect(fs.renameSync).toHaveBeenCalledWith(
        expect.stringContaining('report.csv.downloading'),
        expect.stringContaining('inbound/report.csv'),
      )
      expect(result.fileName).toBe('report.csv')
    })

    it('should fall back to local cache when S3 fails', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // inbound dir exists
        .mockReturnValueOnce(false) // tmp file doesn't exist
        .mockReturnValueOnce(true) // local file exists (cache hit)
      mockS3ClientService.downloadFile.mockRejectedValue(new Error('S3 unreachable'))
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      const result = await service.downloadFile('cra', 'report.csv')

      expect(mockS3ClientService.downloadFile).toHaveBeenCalled()
      expect(result.filePath).toContain('report.csv')
      expect(result.fileName).toBe('report.csv')
    })

    it('should clean up tmp file on S3 failure', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // inbound dir exists
        .mockReturnValueOnce(true) // tmp file exists
        .mockReturnValueOnce(true) // local file exists (cache hit)
      mockS3ClientService.downloadFile.mockRejectedValue(new Error('S3 unreachable'))
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      await service.downloadFile('cra', 'report.csv')

      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('.downloading'))
    })

    it('should decrypt .p7m file when encryption is enabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // inbound dir exists

      const mockReadable = new Readable({ read() {} })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)

      const mockDecryptStderr = new EventEmitter()
      const mockDecryptProcess = new EventEmitter() as any
      mockDecryptProcess.stderr = mockDecryptStderr
      vi.mocked(spawn).mockReturnValue(mockDecryptProcess as any)

      const downloadPromise = service.downloadFile('cra', 'report.csv.p7m')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })
      mockReadable.push('encrypted-data')
      mockReadable.push(null)

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })
      mockDecryptProcess.emit('close', 0)

      const result = await downloadPromise

      expect(result.fileName).toBe('report.csv')
      expect(result.filePath).toContain('report.csv')
    })

    it('should NOT decrypt .p7m file when encryption is disabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // inbound dir exists

      const mockReadable = new Readable({ read() {} })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      const downloadPromise = service.downloadFile('cra', 'report.csv.p7m')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })
      mockReadable.push('data')
      mockReadable.push(null)

      const result = await downloadPromise

      expect(spawn).not.toHaveBeenCalled()
      expect(result.fileName).toBe('report.csv.p7m')
      expect(result.filePath).toContain('report.csv.p7m')
    })

    it('should throw NotFoundException when S3 fails and no local cache', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // inbound dir exists
        .mockReturnValueOnce(false) // tmp file doesn't exist
        .mockReturnValueOnce(false) // no local cache
      mockS3ClientService.downloadFile.mockRejectedValue(new Error('NoSuchKey'))

      await expect(service.downloadFile('cra', 'missing.csv')).rejects.toThrow(NotFoundException)
    })

    it('should create inbound directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false) // inbound dir doesn't exist

      const mockReadable = new Readable({ read() {} })
      mockS3ClientService.downloadFile.mockResolvedValue(mockReadable)

      const { PassThrough } = await import('stream')
      const mockWriteStream = new PassThrough()
      vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
      ;(SERVER_CONFIG as any).encryptionEnabled = false

      const downloadPromise = service.downloadFile('cra', 'report.csv')

      await vi.waitFor(() => {
        expect(fs.createWriteStream).toHaveBeenCalled()
      })
      mockReadable.push('data')
      mockReadable.push(null)

      await downloadPromise

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('inbound'), {
        recursive: true,
      })
    })
  })

  describe('storageHealthCheck', () => {
    it('should return SUCCESS when S3 is reachable', async () => {
      mockS3ClientService.healthCheck.mockResolvedValue(true)

      const result = await service.storageHealthCheck()

      expect(result.status).toBe('SUCCESS')
      expect(result.statusCode).toBe(200)
      expect(result.message).toBe('S3 storage is healthy')
    })

    it('should return FAILED when S3 is not reachable', async () => {
      mockS3ClientService.healthCheck.mockResolvedValue(false)

      const result = await service.storageHealthCheck()

      expect(result.status).toBe('FAILED')
      expect(result.statusCode).toBe(503)
      expect(result.message).toBe('S3 storage is not reachable')
    })
  })

  describe('listOutboundFiles', () => {
    it('should return files from outbound directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['file1.txt', 'file2.txt'] as any)
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date('2025-01-15T10:00:00Z'),
      } as any)

      const result = service.listOutboundFiles('cra')

      expect(result.status).toBe('SUCCESS')
      expect(result.destinationId).toBe('cra')
      expect(result.files).toHaveLength(2)
      expect(result.files[0]).toEqual({
        fileName: 'file1.txt',
        size: 1024,
        deliveredAt: '2025-01-15T10:00:00.000Z',
      })
    })

    it('should return empty array when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = service.listOutboundFiles('cra')

      expect(result.status).toBe('SUCCESS')
      expect(result.files).toEqual([])
    })
  })
})

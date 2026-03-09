import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { HttpException } from '@nestjs/common'

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

import { TransferOutboundController } from './outbound.file.controller'
import { TransferOutboundService } from '../services/outbound-file.service'

describe('TransferOutboundController', () => {
  let controller: TransferOutboundController

  const mockService = {
    uploadFile: vi.fn(),
    checkFileDeliveryStatus: vi.fn(),
    listRemoteFiles: vi.fn(),
    downloadRemoteFile: vi.fn(),
    downloadLocalFile: vi.fn(),
    storageHealthCheck: vi.fn(),
    listAllLocalFiles: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferOutboundController],
      providers: [
        {
          provide: TransferOutboundService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<TransferOutboundController>(TransferOutboundController)
  })

  describe('uploadFile', () => {
    const mockFile = {
      originalname: 'test.txt',
      buffer: Buffer.from('test content'),
      mimetype: 'text/plain',
    } as any

    const mockBody = {
      fileName: 'test.txt',
      destinationId: 'cra-ftp',
    }

    it('should throw HttpException with 400 status if file is missing', async () => {
      await expect(controller.uploadFile(undefined as any, mockBody)).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile(undefined as any, mockBody)
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should throw HttpException with 400 status if destinationId is missing', async () => {
      const body = { fileName: 'test.txt', destinationId: '' }

      await expect(controller.uploadFile(mockFile, body)).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile(mockFile, body)
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should throw HttpException with 400 status if fileName is missing', async () => {
      const body = { fileName: '', destinationId: 'cra-ftp' }

      await expect(controller.uploadFile(mockFile, body)).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile(mockFile, body)
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should call service.uploadFile and return success response', async () => {
      const expectedResponse = {
        statusCode: 200,
        status: 'SUCCESS',
        message: 'File uploaded successfully to S3',
        fileName: 'test.txt.p7m',
        destinationId: 'cra-ftp',
      }
      mockService.uploadFile.mockResolvedValue(expectedResponse)

      const result = await controller.uploadFile(mockFile, mockBody)

      expect(mockService.uploadFile).toHaveBeenCalledWith({
        file: mockFile,
        destinationId: 'cra-ftp',
        fileName: 'test.txt',
      })
      expect(result).toEqual(expectedResponse)
    })

    it('should convert service error into HttpException', async () => {
      mockService.uploadFile.mockRejectedValue(new Error('S3 upload failed'))

      await expect(controller.uploadFile(mockFile, mockBody)).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile(mockFile, mockBody)
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(500)
        const response = error.getResponse()
        expect(response.status).toBe('FAILED')
        expect(response.message).toBe('S3 upload failed')
      }
    })
  })

  describe('checkFileDeliveryStatus', () => {
    it('should call service and return delivery status', async () => {
      const expectedResponse = {
        status: 'SUCCESS',
        statusCode: 200,
        message: 'File delivered successfully to the destination',
        local: 'Delivered',
        remote: 'Delivered',
      }
      mockService.checkFileDeliveryStatus.mockResolvedValue(expectedResponse)

      const result = await controller.checkFileDeliveryStatus('cra-ftp', 'test.txt')

      expect(mockService.checkFileDeliveryStatus).toHaveBeenCalledWith('cra-ftp', 'test.txt')
      expect(result).toEqual(expectedResponse)
    })

    it('should propagate service error as rejection', async () => {
      mockService.checkFileDeliveryStatus.mockRejectedValue(new Error('Check failed'))

      await expect(controller.checkFileDeliveryStatus('cra-ftp', 'test.txt')).rejects.toThrow(
        'Check failed',
      )
    })
  })

  describe('listRemoteFiles', () => {
    it('should call service and return remote files', async () => {
      const expectedResponse = {
        status: 'SUCCESS',
        statusCode: 200,
        destinationId: 'cra-ftp',
        files: [],
      }
      mockService.listRemoteFiles.mockResolvedValue(expectedResponse)

      const result = await controller.listRemoteFiles('cra-ftp')

      expect(mockService.listRemoteFiles).toHaveBeenCalledWith('cra-ftp')
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('storageHealthCheck', () => {
    it('should call service and return health status', async () => {
      const expectedResponse = {
        status: 'HEALTHY',
        statusCode: 200,
        message: 'S3 storage is healthy',
      }
      mockService.storageHealthCheck.mockResolvedValue(expectedResponse)

      const result = await controller.storageHealthCheck('cra-ftp')

      expect(mockService.storageHealthCheck).toHaveBeenCalled()
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('listAllLocalFiles', () => {
    it('should call service and return local files', () => {
      const expectedResponse = {
        status: 'SUCCESS',
        destinationId: 'cra-ftp',
        outbound: [],
        inbound: [],
      }
      mockService.listAllLocalFiles.mockReturnValue(expectedResponse)

      const result = controller.listAllLocalFiles('cra-ftp')

      expect(mockService.listAllLocalFiles).toHaveBeenCalledWith('cra-ftp')
      expect(result).toEqual(expectedResponse)
    })

    it('should throw HttpException for invalid destinationId', () => {
      expect(() => controller.listAllLocalFiles('invalid-dest')).toThrow(HttpException)
    })
  })
})

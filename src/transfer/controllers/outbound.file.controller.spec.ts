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
    listOutboundFiles: vi.fn(),
    listInboundFiles: vi.fn(),
    downloadFile: vi.fn(),
    storageHealthCheck: vi.fn(),
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

    it('should throw HttpException with 400 if file is missing', async () => {
      await expect(
        controller.uploadFile('cra', undefined as any, { fileName: 'test.txt' }),
      ).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile('cra', undefined as any, { fileName: 'test.txt' })
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should throw HttpException with 400 if fileName is missing', async () => {
      await expect(controller.uploadFile('cra', mockFile, { fileName: '' })).rejects.toThrow(
        HttpException,
      )

      try {
        await controller.uploadFile('cra', mockFile, { fileName: '' })
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should throw HttpException with 400 for invalid destinationId', async () => {
      await expect(
        controller.uploadFile('invalid-dest', mockFile, { fileName: 'test.txt' }),
      ).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile('invalid-dest', mockFile, { fileName: 'test.txt' })
      } catch (error) {
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should throw HttpException with 400 for path traversal in fileName', async () => {
      await expect(
        controller.uploadFile('cra', mockFile, { fileName: '../etc/passwd' }),
      ).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile('cra', mockFile, { fileName: '../etc/passwd' })
      } catch (error) {
        expect(error.getStatus()).toBe(400)
      }
    })

    it('should call service.uploadFile and return success', async () => {
      const expectedResponse = {
        statusCode: 200,
        status: 'SUCCESS',
        message: 'File uploaded successfully to S3',
        fileName: 'test.txt.p7m',
        destinationId: 'cra',
      }
      mockService.uploadFile.mockResolvedValue(expectedResponse)

      const result = await controller.uploadFile('cra', mockFile, { fileName: 'test.txt' })

      expect(mockService.uploadFile).toHaveBeenCalledWith({
        file: mockFile,
        destinationId: 'cra',
        fileName: 'test.txt',
      })
      expect(result).toEqual(expectedResponse)
    })

    it('should convert service error into HttpException', async () => {
      mockService.uploadFile.mockRejectedValue(new Error('S3 upload failed'))

      await expect(
        controller.uploadFile('cra', mockFile, { fileName: 'test.txt' }),
      ).rejects.toThrow(HttpException)

      try {
        await controller.uploadFile('cra', mockFile, { fileName: 'test.txt' })
      } catch (error) {
        expect(error.getStatus()).toBe(500)
        const response = error.getResponse()
        expect(response.status).toBe('FAILED')
        expect(response.message).toBe('S3 upload failed')
      }
    })
  })

  describe('checkFileDeliveryStatus', () => {
    it('should call service and return status', async () => {
      const expectedResponse = {
        status: 'SUCCESS',
        message: 'File delivered successfully',
      }
      mockService.checkFileDeliveryStatus.mockResolvedValue(expectedResponse)

      const result = await controller.checkFileDeliveryStatus('cra', 'test.txt')

      expect(mockService.checkFileDeliveryStatus).toHaveBeenCalledWith('cra', 'test.txt')
      expect(result).toEqual(expectedResponse)
    })

    it('should throw for invalid destinationId', async () => {
      await expect(controller.checkFileDeliveryStatus('invalid', 'test.txt')).rejects.toThrow(
        HttpException,
      )
    })

    it('should throw for path traversal in fileName', async () => {
      await expect(
        controller.checkFileDeliveryStatus('cra', '../../../etc/passwd'),
      ).rejects.toThrow(HttpException)
    })
  })

  describe('listOutboundFiles', () => {
    it('should call service and return outbound files', () => {
      const expectedResponse = {
        status: 'SUCCESS',
        destinationId: 'cra',
        files: [],
      }
      mockService.listOutboundFiles.mockReturnValue(expectedResponse)

      const result = controller.listOutboundFiles('cra')

      expect(mockService.listOutboundFiles).toHaveBeenCalledWith('cra')
      expect(result).toEqual(expectedResponse)
    })

    it('should throw for invalid destinationId', () => {
      expect(() => controller.listOutboundFiles('invalid')).toThrow(HttpException)
    })
  })

  describe('listInboundFiles', () => {
    it('should call service and return inbound files', async () => {
      const expectedResponse = {
        status: 'SUCCESS',
        destinationId: 'cra',
        files: [],
      }
      mockService.listInboundFiles.mockResolvedValue(expectedResponse)

      const result = await controller.listInboundFiles('cra')

      expect(mockService.listInboundFiles).toHaveBeenCalledWith('cra')
      expect(result).toEqual(expectedResponse)
    })

    it('should throw for invalid destinationId', async () => {
      await expect(controller.listInboundFiles('invalid')).rejects.toThrow(HttpException)
    })
  })

  describe('storageHealthCheck', () => {
    it('should call service and return health status', async () => {
      const expectedResponse = {
        status: 'SUCCESS',
        statusCode: 200,
        message: 'S3 storage is healthy',
      }
      mockService.storageHealthCheck.mockResolvedValue(expectedResponse)

      const result = await controller.storageHealthCheck('cra')

      expect(mockService.storageHealthCheck).toHaveBeenCalled()
      expect(result).toEqual(expectedResponse)
    })

    it('should throw for invalid destinationId', async () => {
      await expect(controller.storageHealthCheck('invalid')).rejects.toThrow(HttpException)
    })
  })
})

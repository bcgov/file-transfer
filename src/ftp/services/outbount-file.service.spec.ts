import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FtpOutboundService } from './outbound-file.service'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import * as fs from 'fs'
import { File as MulterFile } from 'multer'

// 🔥 Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}))

describe('FtpOutboundService', () => {
  let service: FtpOutboundService
  // let ftpClientService: FtpClientService

  const mockFtpClientService = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  }

  const mockFile = {
    originalname: 'test.txt',
    buffer: Buffer.from('file-content'),
  } as MulterFile

  beforeEach(() => {
    service = new FtpOutboundService(mockFtpClientService as unknown as FtpClientService)

    vi.clearAllMocks()
  })

  describe('uploadFileToCra', () => {
    it('should upload file successfully and move it to sent folder', async () => {
      // Arrange
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.uploadFile.mockResolvedValue({
        code: 226,
        message: 'Transfer complete',
      })

      // Act
      const result = await service.uploadFileToCra({
        file: mockFile,
        destinationId: 'cra-ftp',
        fileName: 'test.txt',
      })

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(mockFtpClientService.uploadFile).toHaveBeenCalledOnce()
      expect(fs.renameSync).toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 226,
        status: COMMON_CONSTANT.RESPONSE_STATUS.DELIVERED,
        message: 'Transfer complete',
        fileName: 'test.txt',
      })
    })

    it('should throw error when FTP upload fails', async () => {
      // Arrange
      ;(fs.existsSync as any).mockReturnValue(true)

      mockFtpClientService.uploadFile.mockResolvedValue({
        code: 550,
        message: 'Permission denied',
      })

      // Act & Assert
      await expect(
        service.uploadFileToCra({
          file: mockFile,
          destinationId: 'cra-ftp',
          fileName: 'test.txt',
        }),
      ).rejects.toThrow('Failed to upload file to CRA FTP server: Permission denied')
    })
  })

  // describe('downloadFile', () => {
  //   it('should call ftpClientService.downloadFile', async () => {
  //     mockFtpClientService.downloadFile.mockResolvedValue('success')

  //     const result = await service.downloadFile()

  //     expect(mockFtpClientService.downloadFile).toHaveBeenCalledOnce()
  //     expect(result).toBe('success')
  //   })
  // })
})

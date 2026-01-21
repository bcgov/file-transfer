import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FtpOutboundService } from './outbound-file.service'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import * as fs from 'fs'
import { File as MulterFile } from 'multer'

const { RESPONSE_STATUS, cra_remoteDir } = COMMON_CONSTANT

//  Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

describe('FtpOutboundService', () => {
  let service: FtpOutboundService

  const mockFtpClientService = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    checkFileExist: vi.fn(),
    listFiles: vi.fn(),
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
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.uploadFile.mockResolvedValue({
        code: 226,
        message: 'Transfer complete',
      })

      const result = await service.uploadFileToCra({
        file: mockFile,
        destinationId: 'cra-ftp',
        fileName: 'test.txt',
      })

      expect(fs.mkdirSync).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(mockFtpClientService.uploadFile).toHaveBeenCalledOnce()
      expect(fs.renameSync).toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 226,
        status: RESPONSE_STATUS.DELIVERED,
        message: 'Transfer complete',
        fileName: 'test.txt',
      })
    })

    it('should throw error when FTP upload fails', async () => {
      ;(fs.existsSync as any)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)

      mockFtpClientService.uploadFile.mockResolvedValue({
        code: 550,
        message: 'Permission denied',
      })

      await expect(
        service.uploadFileToCra({
          file: mockFile,
          destinationId: 'cra-ftp',
          fileName: 'test.txt',
        }),
      ).rejects.toThrow('Failed to upload file to CRA FTP server: Permission denied')
    })
  })

  //  FIXED TESTS BELOW (ONLY THIS SECTION CHANGED)
  describe('FileDeliverStatus', () => {
    it('should return DELIVERED when file exists in local sent directory', async () => {
      ;(fs.existsSync as any).mockImplementation((filePath: string) => filePath.includes('sent'))

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(result).toEqual({
        status: RESPONSE_STATUS.DELIVERED,
        statusCode: 200,
        messge: 'File Uploded Successfuly to the Destination',
      })
    })

    it('should return FAILED when file not found locally and not on remote FTP', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.checkFileExist.mockResolvedValue(false)

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(mockFtpClientService.checkFileExist).toHaveBeenCalledWith(cra_remoteDir, 'test.txt')

      expect(result).toEqual({
        status: RESPONSE_STATUS.FAILED,
        statusCode: 404,
        message: 'File not Found',
      })
    })

    it('should move file from temp to sent and return DELIVERED when file exists on remote', async () => {
      ;(fs.existsSync as any).mockImplementation((filePath: string) => filePath.includes('temp'))

      mockFtpClientService.checkFileExist.mockResolvedValue(true)

      const renameSpy = vi.spyOn(fs, 'renameSync')

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(renameSpy).toHaveBeenCalledOnce()

      expect(result).toEqual({
        status: RESPONSE_STATUS.DELIVERED,
        statusCode: 200,
        message: 'File Uploded successfuly to the Destination',
      })
    })

    it('should return DELIVERED when file exists on remote but temp file does not exist', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.checkFileExist.mockResolvedValue(true)

      const renameSpy = vi.spyOn(fs, 'renameSync')

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(renameSpy).not.toHaveBeenCalled()

      expect(result).toEqual({
        status: RESPONSE_STATUS.DELIVERED,
        statusCode: 200,
        message: 'File Uploded successfuly to the Destination',
      })
    })
  })

  // List file endpoint Test case
  describe('ListFiles', async () => {
    it('It should list all the files from Remote server', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([
        {
          name: 'test.txt',
          size: 656,
          rawModifiedAt: 'Jan 20 06:19',
        },
      ])

      const result = await service.listFiles('remoteDir')

      expect(result.status).toEqual('DELIVERED')
      expect(result.statusCode).toEqual(200)
      expect(result.data).toBeTypeOf('object')
      expect(result.data.files).toBeTypeOf('object')
    })

    it('should return FAILED when FTP client throws an error', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('FTP connection failed'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('FTP connection failed')
    })

    it('should return FAILED when remote directory does not exist', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('Directory not found'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('Directory not found')
    })

    it('should return DELIVERED with empty files list when no files exist', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([])

      const result = await service.listFiles('remoteDir')

      expect(result.status).toEqual('DELIVERED')
      expect(result.statusCode).toEqual(200)
      expect(result.data.files).toEqual([])
    })
  })
})

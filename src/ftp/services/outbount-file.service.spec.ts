import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FtpOutboundService } from './outbound-file.service'
import { FtpClientService } from './ftp-client.service'
import { COMMON_CONSTANT } from '../../common/common.constant'
import * as fs from 'fs'
import { File as MulterFile } from 'multer'
import { NotFoundException } from '@nestjs/common'

const { RESPONSE_STATUS, LOCAL_DIRECTORY } = COMMON_CONSTANT

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
    downloadSingleFile: vi.fn(),
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
    it(`should upload file successfully and move it to${LOCAL_DIRECTORY.outbound}  folder`, async () => {
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

      expect(result.status).toEqual(RESPONSE_STATUS.SUCCESS)
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
    it(`should return SUCCESS when file exists in local ${LOCAL_DIRECTORY.outbound} directory`, async () => {
      ;(fs.existsSync as any).mockImplementation((filePath: string) =>
        filePath.includes(LOCAL_DIRECTORY.outbound),
      )

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(result.status).toEqual(RESPONSE_STATUS.SUCCESS)
    })

    it('should return FAILED when file not found locally and not on remote FTP', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.checkFileExist.mockResolvedValue(false)

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(mockFtpClientService.checkFileExist).toHaveBeenCalledWith('DEST1', 'test.txt')

      expect(result.status).toEqual(RESPONSE_STATUS.FAILED)
    })

    it(`should move file from ${LOCAL_DIRECTORY.temp} to ${LOCAL_DIRECTORY.outbound} and return SUCCESS when file exists on remote`, async () => {
      ;(fs.existsSync as any).mockImplementation((filePath: string) =>
        filePath.includes(LOCAL_DIRECTORY.temp),
      )

      mockFtpClientService.checkFileExist.mockResolvedValue(true)

      const renameSpy = vi.spyOn(fs, 'renameSync')

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(renameSpy).toHaveBeenCalledOnce()

      expect(result.status).toEqual(RESPONSE_STATUS.SUCCESS)
    })

    it(`should return SUCCESS when file exists on remote but ${LOCAL_DIRECTORY.temp} file does not exist`, async () => {
      ;(fs.existsSync as any).mockReturnValue(false)

      mockFtpClientService.checkFileExist.mockResolvedValue(true)

      const renameSpy = vi.spyOn(fs, 'renameSync')

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(renameSpy).not.toHaveBeenCalled()

      expect(result.status).toEqual(RESPONSE_STATUS.SUCCESS)
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

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toBeTypeOf('object')
    })

    it('should return FAILED when FTP client throws an error', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('FTP connection failed'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('FTP connection failed')
    })

    it('should return FAILED when remote directory does not exist', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('Directory not found'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('Directory not found')
    })

    it('should return SUCCESS with empty files list when no files exist', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([])

      const result = await service.listFiles('remoteDir')

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toEqual([])
    })
  })

  // Download file

  describe('FtpOutboundService - downloadFileFromLocalOrFtp', () => {
    it('should create inbound directory if it does not exist and return outbound file if already exists', async () => {
      // inboundDir does not exist -> mkdirSync should be called
      // outboundFile exists -> should return outbound file path
      ;(fs.existsSync as any).mockImplementation((filePath: string) => {
        if (String(filePath).includes('inbound')) return false
        if (String(filePath).includes('outbound')) return true
        return false
      })

      const result = await service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')

      expect(fs.mkdirSync).toHaveBeenCalledOnce()
      expect(mockFtpClientService.downloadSingleFile).not.toHaveBeenCalled()

      expect(result.remoteFileName).toBe('test.txt')
      expect(result.filePath).toContain('outbound')
      expect(result.filePath).toContain('test.txt')
    })

    it('should download from FTP and return inbound file path when outbound file does not exist', async () => {
      // inboundDir exists
      // outboundFile does not exist
      // after download inboundFile exists
      ;(fs.existsSync as any).mockImplementation((filePath: string) => {
        if (String(filePath).includes('inbound') && !String(filePath).endsWith('.txt')) return true

        if (String(filePath).includes('outbound')) return false

        // inbound file after download
        if (String(filePath).includes('inbound') && String(filePath).endsWith('test.txt'))
          return true

        return false
      })

      mockFtpClientService.downloadSingleFile.mockResolvedValue(true)

      const result = await service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')

      expect(mockFtpClientService.downloadSingleFile).toHaveBeenCalledOnce()
      expect(result.remoteFileName).toBe('test.txt')
      expect(result.filePath).toContain('inbound')
      expect(result.filePath).toContain('test.txt')
    })

    it('should throw NotFoundException when FTP downloadSingleFile returns false', async () => {
      // inboundDir exists
      // outboundFile does not exist
      ;(fs.existsSync as any).mockImplementation((filePath: string) => {
        if (String(filePath).includes('inbound') && !String(filePath).endsWith('.txt')) return true

        if (String(filePath).includes('outbound')) return false

        return false
      })

      mockFtpClientService.downloadSingleFile.mockResolvedValue(false)

      await expect(service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')).rejects.toBeInstanceOf(
        NotFoundException,
      )

      await expect(service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')).rejects.toThrow(
        'File not Found: test.txt',
      )
    })

    it('should throw NotFoundException when FTP returns true but file not found locally after download', async () => {
      // inboundDir exists
      // outboundFile does not exist
      // inboundFile after download still does NOT exist
      ;(fs.existsSync as any).mockImplementation((filePath: string) => {
        if (String(filePath).includes('inbound') && !String(filePath).endsWith('.txt')) return true

        if (String(filePath).includes('outbound')) return false

        // inbound file still missing after download
        if (String(filePath).includes('inbound') && String(filePath).endsWith('test.txt'))
          return false

        return false
      })

      mockFtpClientService.downloadSingleFile.mockResolvedValue(true)

      await expect(service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')).rejects.toBeInstanceOf(
        NotFoundException,
      )

      await expect(service.downloadFileFromLocalOrFtp('DEST1', 'test.txt')).rejects.toThrow(
        'Downloaded file not found locally after FTP download: test.txt',
      )
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

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toBeTypeOf('object')
    })

    it('should return FAILED when FTP client throws an error', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('FTP connection failed'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('FTP connection failed')
    })

    it('should return FAILED when remote directory does not exist', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('Directory not found'))

      await expect(service.listFiles('remoteDir')).rejects.toThrow('Directory not found')
    })

    it('should return SUCCESS with empty files list when no files exist', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([])

      const result = await service.listFiles('remoteDir')

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toEqual([])
    })
  })
})

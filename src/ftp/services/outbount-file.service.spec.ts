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
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('child_process', () => {
  return {
    spawn: vi.fn(() => {
      return {
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0) // simulate successful OpenSSL exit
          }
        }),
      }
    }),
  }
})

describe('FtpOutboundService', () => {
  let service: FtpOutboundService

  const mockFtpClientService = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    checkFileExist: vi.fn(),
    listFiles: vi.fn(),
    downloadSingleFile: vi.fn(),
    ftpHealthCheck: vi.fn(),
    listAllLocalFiles: vi.fn(),
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
    it(`should return FAILED when file exists locally but not on remote FTP`, async () => {
      ;(fs.existsSync as any).mockImplementation((filePath: string) =>
        filePath.includes(LOCAL_DIRECTORY.outbound),
      )

      mockFtpClientService.checkFileExist.mockResolvedValue(false)

      const result = await service.checkFileDeliveryStatus('DEST1', 'test.txt')

      expect(result.status).toEqual(RESPONSE_STATUS.FAILED)
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
  describe('ListRemoteFiles', async () => {
    it('It should list all the files from Remote server', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([
        {
          name: 'test.txt',
          size: 656,
          rawModifiedAt: 'Jan 20 06:19',
        },
      ])

      const result = await service.listRemoteFiles('remoteDir')

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toBeTypeOf('object')
    })

    it('should return FAILED when FTP client throws an error', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('FTP connection failed'))

      await expect(service.listRemoteFiles('remoteDir')).rejects.toThrow('FTP connection failed')
    })

    it('should return FAILED when remote directory does not exist', async () => {
      mockFtpClientService.listFiles.mockRejectedValue(new Error('Directory not found'))

      await expect(service.listRemoteFiles('remoteDir')).rejects.toThrow('Directory not found')
    })

    it('should return SUCCESS with empty files list when no files exist', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([])

      const result = await service.listRemoteFiles('remoteDir')

      expect(result.status).toEqual('SUCCESS')
      expect(result.statusCode).toEqual(200)
      expect(result.files).toEqual([])
    })
  })

  // Download file

  describe('FtpOutboundService - downloadRemoteFile', () => {
    it('should create inbound directory if it does not exist and download file from FTP', async () => {
      // inboundDir does not exist
      // inboundFile does not exist initially
      ;(fs.existsSync as any).mockImplementation((filePath: string) => {
        if (String(filePath).includes('inbound') && !String(filePath).endsWith('.txt')) return false

        // file exists AFTER download
        if (String(filePath).includes('inbound') && String(filePath).endsWith('test.txt'))
          return true

        return false
      })

      mockFtpClientService.downloadSingleFile.mockResolvedValue(true)

      const result = await service.downloadRemoteFile('DEST1', 'test.txt')

      expect(fs.mkdirSync).toHaveBeenCalledOnce()
      expect(mockFtpClientService.downloadSingleFile).toHaveBeenCalledOnce()

      expect(result.decryptedFileName).toBe('test.txt')
      expect(result.filePath).toContain('inbound')
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

      const result = await service.downloadRemoteFile('DEST1', 'test.txt')

      expect(mockFtpClientService.downloadSingleFile).toHaveBeenCalledOnce()
      expect(result.decryptedFileName).toBe('test.txt')
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

      await expect(service.downloadRemoteFile('DEST1', 'test.txt')).rejects.toBeInstanceOf(
        NotFoundException,
      )

      await expect(service.downloadRemoteFile('DEST1', 'test.txt')).rejects.toThrow(
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

      await expect(service.downloadRemoteFile('DEST1', 'test.txt')).rejects.toBeInstanceOf(
        NotFoundException,
      )

      await expect(service.downloadRemoteFile('DEST1', 'test.txt')).rejects.toThrow(
        'Downloaded file not found locally after FTP download: test.txt',
      )
    })
  })

  // Health check test cases

  describe('Health Check FTP', () => {
    it('should return HEALTHY when remote server has files', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([{ name: 'test.txt', size: 100 }])

      const result = await service.ftpHealthCheck()

      expect(mockFtpClientService.listFiles).toHaveBeenCalledOnce()
      expect(result).toEqual({
        status: 'HEALTHY',
        statusCode: 200,
        message: 'Ftp Server is Healthy',
      })
    })

    it('should return UNHEALTHY when no files found', async () => {
      mockFtpClientService.listFiles.mockResolvedValue([])

      const result = await service.ftpHealthCheck()

      expect(result).toEqual({
        status: 'UNHEALTHY',
        statusCode: 503,
        message: 'Ftp Server is not reachable',
      })
    })
  })

  // History to list all local files

  describe('listAllLocalFiles', () => {
    it('should return inbound and outbound file history', () => {
      // Arrange
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readdirSync as any).mockImplementation((dirPath: string) => {
        if (dirPath.includes('outbound')) {
          return ['batch-001', 'batch-002']
        }
        if (dirPath.includes('inbound')) {
          return ['response-001']
        }
        return []
      })
      ;(fs.statSync as any).mockImplementation(() => ({
        isFile: () => true,
        size: 256000,
        mtime: new Date('2025-01-09T14:30:00Z'),
      }))

      // Act
      const result = service.listAllLocalFiles('csa-ftp')

      // Assert
      expect(result).toEqual({
        status: 'SUCCESS',
        destinationId: 'csa-ftp',
        outbound: [
          {
            fileName: 'batch-001',
            size: 256000,
            deliveredAt: '2025-01-09T14:30:00.000Z',
          },
          {
            fileName: 'batch-002',
            size: 256000,
            deliveredAt: '2025-01-09T14:30:00.000Z',
          },
        ],
        inbound: [
          {
            fileName: 'response-001',
            size: 256000,
            downloadedAt: '2025-01-09T14:30:00.000Z',
          },
        ],
      })
    })

    it('should return empty arrays when directories exist but have no files', () => {
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readdirSync as any).mockReturnValue([])

      const result = service.listAllLocalFiles('csa-ftp')

      expect(result).toEqual({
        status: RESPONSE_STATUS.SUCCESS,
        destinationId: 'csa-ftp',
        outbound: [],
        inbound: [],
      })
    })

    it('should return empty arrays when directories do not exist', () => {
      ;(fs.existsSync as any).mockReturnValue(false)

      const result = service.listAllLocalFiles('csa-ftp')

      expect(result).toEqual({
        status: RESPONSE_STATUS.SUCCESS,
        destinationId: 'csa-ftp',
        outbound: [],
        inbound: [],
      })

      expect(fs.readdirSync).not.toHaveBeenCalled()
    })
  })
})

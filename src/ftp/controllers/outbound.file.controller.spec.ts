import { HttpException, HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FtpOutboundController } from './outbound.file.controller'
import { FtpOutboundService } from '../services/outbound-file.service'
import { CreateFileDto } from '../dto/outbound.file.dto'
import { File as MulterFile } from 'multer'

describe('FileTransferController', () => {
  let controller: FtpOutboundController
  let ftpService: FtpOutboundService

  const mockFtpOutboundService = {
    uploadFileToCra: vi.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FtpOutboundController],
      providers: [
        {
          provide: FtpOutboundService,
          useValue: mockFtpOutboundService,
        },
      ],
    }).compile()

    controller = module.get(FtpOutboundController)
    ftpService = module.get(FtpOutboundService)

    vi.clearAllMocks()
  })

  const mockFile = {
    originalname: 'test.txt',
    buffer: Buffer.from('file content'),
  } as MulterFile

  it('should throw 400 if file is missing', async () => {
    const body: CreateFileDto = {
      fileName: 'test.txt',
      destinationId: 'cra-ftp',
    }

    await expect(controller.uploadfiletoCra(null as any, body)).rejects.toBeInstanceOf(
      HttpException,
    )
  })

  it('should throw 400 if destinationId or fileName is missing', async () => {
    const body = {
      fileName: '',
      destinationId: '',
    } as CreateFileDto

    await expect(controller.uploadfiletoCra(mockFile, body)).rejects.toBeInstanceOf(HttpException)
  })

  it('should call service and return success response', async () => {
    const body: CreateFileDto = {
      fileName: 'test.txt',
      destinationId: 'cra-ftp',
    }

    const serviceResponse = {
      statusCode: 226,
      message: 'File uploaded successfully',
      file: 'test.txt',
    }

    mockFtpOutboundService.uploadFileToCra.mockResolvedValue(serviceResponse)

    const result = await controller.uploadfiletoCra(mockFile, body)

    expect(ftpService.uploadFileToCra).toHaveBeenCalledOnce()
    expect(ftpService.uploadFileToCra).toHaveBeenCalledWith({
      file: mockFile,
      destinationId: 'cra-ftp',
      fileName: 'test.txt',
    })
    expect(result).toEqual(serviceResponse)
  })

  it('should convert service error into HttpException', async () => {
    const body: CreateFileDto = {
      fileName: 'test.txt',
      destinationId: 'cra-ftp',
    }

    mockFtpOutboundService.uploadFileToCra.mockRejectedValue(
      new HttpException('FTP failed', HttpStatus.INTERNAL_SERVER_ERROR),
    )

    await expect(controller.uploadfiletoCra(mockFile, body)).rejects.toBeInstanceOf(HttpException)
  })
})

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Parser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'basic-ftp';
import { CreateFileDto } from '../dto/outbound.file.dto';
import { FtpClientService } from './ftpClient.service';
import { COMMON_CONSTANT } from '../../common/common.constant'
import { Multer } from 'multer';

const { local_inboundDir, local_outboundDir, cra_remoteDir, csa_remoteDir } = COMMON_CONSTANT

@Injectable()
export class FtpOutboundService implements OnModuleInit {

    constructor(private readonly ftpClientService: FtpClientService) { }
    async processAndUpload(dto: CreateFileDto) {
        const fileName = this.buildFileName(
            dto.system,
            dto.flow,
            dto.fileType,
        );

        // const localDir = path.resolve(process.cwd(), local_outboundDir);
        const localDir = local_outboundDir;
        console.log('Local Dir', localDir)
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir);
        }

        const localFilePath = path.join(localDir, fileName);

        // 1️⃣ Convert JSON to CSV
        const parser = new Parser();
        const csvData = parser.parse(dto.payload);

        // 2️⃣ Write CSV locally
        fs.writeFileSync(localFilePath, csvData);



        // 3️⃣ Upload to FTP
        // await this.uploadToFtp(localFilePath, fileName);
        //   await this.uploadToFtp(localFilePath, `/test/${fileName}`);

        console.log(`Uploading file from ${localFilePath} to FTP server... at Path============>${cra_remoteDir}/${fileName}`);
        let res = await this.ftpClientService.uploadFile(localFilePath, cra_remoteDir, fileName)
        console.log('Response from ftp server', res)

        console.log('File uploded successfuly , fileName', fileName)

        return { fileName };
    }

    private buildFileName(
        system: string,
        flow: string,
        fileType: string,
    ): string {
        const timestamp = new Date()
            .toISOString()
            .replace(/[-T:.Z]/g, '')
            .slice(0, 14);

        const sequence = '001';

        return `${system}-${flow}-${fileType}-${timestamp}-${sequence}.csv`;
    }

    onModuleInit() {
        // setInterval(async () => {
        //     console.log('Checking file is availabel or not')
        //     let result = await this.downloadFile()
        //     console.log('Poling Result', result)
            
        // }, 5000);
    }
    
    async uploadFileToCra (file: Multer.File, userId:string, serviceName:string){

        console.log('uploadFileToCra service called', file, userId, serviceName)

        let localFilePath = path.join(local_outboundDir,'temp', file.originalname)

        fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
        fs.writeFileSync(localFilePath, file.buffer);

        await this.ftpClientService.uploadFile(localFilePath, cra_remoteDir, file.originalname)
        fs.unlinkSync(localFilePath);

        return { statusCode: 200, message: 'File uploded successfuly', file: file.originalname  }

    }

    async downloadFile() {
        return this.ftpClientService.downloadFile(local_inboundDir, csa_remoteDir)
    }
}


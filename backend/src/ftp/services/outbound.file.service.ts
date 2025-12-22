import { Injectable } from '@nestjs/common';
import { Parser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'basic-ftp';
import { CreateFileDto } from '../dto/outbound.file.dto';

@Injectable()
export class FileTransferService {
    async processAndUpload(dto: CreateFileDto) {
        const fileName = this.buildFileName(
            dto.system,
            dto.flow,
            dto.fileType,
        );

        const localDir = path.join(process.cwd(), 'outbound');
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

    private async uploadToFtp(localPath: string, fileName: string) {
        const client = new Client();

        try {
            await client.access({
                host: process.env.FTP_HOST,
                user: process.env.FTP_USER,
                port: + process.env.FTP_PORT,
                password: process.env.FTP_PASSWORD,
                secure: true,
                secureOptions: {
                    rejectUnauthorized: false
                }
            });

            await client.ensureDir('test')

            let ftpResponse = await client.uploadFrom(localPath, fileName);
            console.log('ftp Response', ftpResponse)
        } catch (error) {
            console.log('error============>', error)

        } finally {
            client.close();
        }

    }
}

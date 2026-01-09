

export class CommonHelper {
    static buildFileName(userId: string, documentType: string, extension: string): string {
        return `${userId}_${documentType}.${extension}`;
    }
}
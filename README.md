
# 📁 File Transfer Microservice

A robust NestJS microservice for secure, automated file exchange between organizations using FTP. It supports file upload, download, listing, and health monitoring, with a focus on reliability and extensibility.

---

##  Features
- Encrypts files in memory before uploading to FTP, stores encrypted files locally, then uploads to CRA FTP
- Decrypts files in memory after downloading from CRA FTP, stores decrypted files locally, and returns decrypted file to client
- Upload files to remote FTP servers
- Download files from remote FTP servers
- List local and remote files
- Health check endpoints for FTP connectivity
- Configurable via environment variables
- API documentation via Swagger

---

## 🏗️ Architecture
This service is built with [NestJS](https://nestjs.com/) and follows a modular structure:

- **Controllers:** Handle HTTP requests (upload, download, list, health, etc.)
- **Services:**
	- Handle FTP logic and file operations
	- Encrypt files in memory before upload, decrypt after download
- **DTOs & Interfaces:** Define request/response schemas
- **Config:** Loads FTP and server settings from environment variables

---

## ⚙️ Configuration
Set the following environment variables (e.g., in a `.env` file or your deployment environment):

```
PORT=3000
FTP_HOST=<ftp-server-host>
FTP_PORT=<ftp-server-port>
FTP_USER=<ftp-username>
FTP_PASSWORD=<ftp-password>
OUTBOUND_DIR=<remote-outbound-dir>
INBOUND_DIR=<remote-inbound-dir>
LOCAL_STORAGE_DIR=<local-storage-dir>
```

---

## 🛠️ Setup & Run

1. **Install dependencies:**
	 ```bash
	 npm install
	 ```
2. **Run the service:**
	 ```bash
	 npm run start:dev
	 ```
3. **Access API docs:**
	 Visit [http://localhost:3000/api/docs](http://localhost:3000/api/docs) for Swagger UI.

---

## 📚 API Endpoints


### File Upload
- `POST /api/transfers`
  - Encrypts the uploaded flat file in memory, stores it locally, then uploads the encrypted file to the CRA FTP server.
  - **Body:** `multipart/form-data` with `file`, `destinationId`, `fileName`

### File Delivery Status
- `GET /api/transfers/:destinationId/:fileName`
   - This will ensure file is successfully uploaded to CRA or not
### File Download
- `GET /api/destinations/:destinationId/remote/inbound/files/:fileName`
  - Downloads the encrypted file from the CRA FTP server, decrypts it in memory, stores the decrypted file locally, and returns the decrypted file to the client.
- `GET /api/destinations/:destinationId/local/inbound/:fileName`
  - Download a file from local storage.

### List Files
- `GET /api/destinations/:destinationId/remote-files`
	- List files available on the remote FTP server.
- `GET /api/destinations/:destinationId/local-files`
	- List files available in local storage.

### Health Check
- `GET /api/destinations/:destinationId/health`
	- Check FTP server health status.

---

## 🧩 Project Structure

```
src/
	app.module.ts
	main.ts
	configs/
	common/
	ftp/
		controllers/
		services/
		dto/
		interfaces/
```

---

## 🧪 Testing

Run unit and integration tests:
```bash
npm run test
```

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 🛡️ Security

See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities.

---

## 📞 Support

For questions or support, please open an issue or contact the maintainers.

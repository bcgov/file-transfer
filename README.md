# 📁 File Transfer Microservice (FTP) – NestJS

## 📌 Overview
This project is a **File Transfer Microservice** built using **NestJS** that enables secure, reliable file exchange between systems using **FTP**.

The service is designed for **system-to-system integration**, similar to **CSA ↔ CRA** style communication, where files are exchanged without human interaction.

---

## 🏗️ High-Level Architecture

Client / Upstream System
|
v
+---------------------------+
| File Transfer Microservice|
| (NestJS) |
+---------------------------+
|
v
+---------------------------+
| FTP Server |
+---------------------------+



---

## 🧰 Technology Stack

| Technology | Purpose |
|----------|---------|
| Node.js | Runtime |
| NestJS | Backend framework |
| TypeScript | Strong typing |
| FTP / SFTP | File transfer |
| Joi | Input validation |
| Docker | Containerization |
| OpenShift | Deployment platform |

---

## 📂 Project Structure

src/
├── app.module.ts
├── main.ts
├── user/
│ ├── dto/
│ │ └── create-user.dto.ts
│ ├── interfaces/
│ │ └── user.interface.ts
│ ├── user.controller.ts
│ ├── user.service.ts
│ └── user.module.ts
├── ftp/
| ├── controllers/
| | └── outbound.file.controller.ts
| ├── dto/
│ │ └── outbound.file.dto.ts
| ├── services/
│ │ └── outbound.file.service.ts
├── common/
│ ├── interfaces/
│ └── utils/
└── config/
| └── ftp.config.ts


---

## 🚀 Getting Started

### 1️⃣ Prerequisites
- Node.js ≥ 18
- npm or yarn
- NestJS CLI
- Access to an FTP/SFTP server

---

### 2️⃣ Installation

```bash
git clone https://github.com/bcgov/file-transfer
cd file-transfer/backend
npm install

3️⃣ Environment Configuration

Create a .env file in the root directory:

FTP_HOST=ftp.example.com
FTP_PORT=21
FTP_USER=username
FTP_PASSWORD=password

4️⃣ Run the Application
npm run start:dev


Application will start on:

http://localhost:3000

📡 API Endpoints
📤 Upload File
POST /file-transfer/upload
Content-Type: application/json

📥 Download File
GET /file-transfer/download?fileName=test.txt

👤 Create User (Sample API)
POST /user
Content-Type: application/json

{
  "name": "Saif",
  "email": "saif@test.com",
  "age": 25
}

🔐 Validation & Security

DTO-based validation using Joi

Invalid requests return 400 Bad Request

🧠 Design Principles

Modular architecture

DTO-based request validation

Separation of concerns

Interface-driven service logic

Microservice-ready

⚠️ Error Handling
Scenario	HTTP Status
Validation failure	400
File not found	404
FTP connection error	503
Unexpected error	500
🚢 Deployment (OpenShift)
Build Docker Image
docker build -t file-transfer-service .

Deployment Steps

Create OpenShift project

Deploy container image

Configure environment variables using ConfigMaps and Secrets

📈 Future Enhancements

SFTP support

Retry & backoff mechanism

File checksum validation

Audit logging

Async processing using message queues

Swagger API documentation

Authentication & authorization

🧪 Development Notes

Controllers use DTOs

Services use interfaces/types

Interfaces are not used for request validation

In-memory storage used for demo (DB-ready design)

👨‍💻 Author

Md Saif Raza
Backend Developer – NestJS | Node.js


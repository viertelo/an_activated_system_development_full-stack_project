# 🛡️ Enterprise License Activation System (B2B2C)

> 🇨🇳 [中文文档 (Chinese Version)](./README_zh.md)

![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)
![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg?style=for-the-badge&logo=dotnet)
![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-black.svg?style=for-the-badge&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1.svg?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=for-the-badge&logo=docker)
![Security](https://img.shields.io/badge/Security-Passkey_%7C_RSA_2048-success.svg?style=for-the-badge)

Welcome to the **Enterprise License Activation System**! This system is specifically designed for commercial software utilizing a **B2B2C (Channel Distribution/E-commerce)** model.

In the B2B2C model, the system perfectly separates the business boundaries between **Administrator Management** and **End-User Activation**. It employs the most rigorous encryption strategies and a modernized full-stack architecture to protect your software IP, making licensing, authorization, and device management rock-solid.

---

## ✨ Core Enterprise Features

> [!TIP]
> **Tailored for License Distributors & Resellers**: End-users **do not need to provide an email or register** during activation. A single license key and a hardware footprint are all that's required for one-click binding. This minimizes the barrier to entry for end consumers!

- **🔄 Auto-Revoke & Device Transfer**: Supports configuring "Max Devices" and "Max Activations (Transfers)" for license keys. When a user activates on a new device, if all device slots are full but transfers are allowed, the system will **automatically revoke the oldest device**. This easily restricts multi-boxing while eliminating the hassle of manual unbinding.
- **🔐 Zero-Exposure Cryptographic Security (Offline RSA Anti-Tampering)**: The database only stores the SHA256 hash of the license keys. Offline client-side verification uses a 2048-bit `RSA + SHA256` digital signature mechanism, fundamentally preventing crackers from forging or tampering with authorization expiration dates.
- **📱 Hardware-Level Passwordless Authentication (Passkey & WebAuthn)**: In addition to traditional accounts and passwords, the admin dashboard fully supports modernized **Passkey (Biometrics/FaceID)** logins. This reduces the risk of internal admin account theft to the lowest physical level.
- **🛡️ Anti-Brute Force & Concurrent Login Prevention**: Supports **auto-kick** for the same super admin account logged in from multiple locations, strictly ensuring session uniqueness. Built-in brute-force prevention locks the account for 15 minutes after 3 consecutive incorrect password attempts.
- **📊 High-Performance Real-time Analytics Dashboard**: Features a graphical admin dashboard (`/admin`) that tracks **Today's New Activations** and **Intercepted Attack Volumes** in real-time. Supports generating thousands of license keys in a single second, and **one-click exporting of fully formatted CSV reports**, perfectly integrating with major automated license delivery platforms.
- **🚀 Extreme Lightweight & Full-Stack Performance Optimization**: The frontend uses Next.js 16 (Static Export) for static building, seamlessly adapting to Nginx. The backend uses a tiny .NET Alpine image, integrating **IMemoryCache** for high-speed memory caching and Entity Framework no-tracking query optimizations, remaining stable even during high-concurrency flash sales or mass activations.
- **🐳 Containerized Black-Box Defense**: Deployed via Docker Compose, the database and backend API ports are completely sealed within a virtual intranet. The only external window is strictly guarded by Nginx, with forced full-chain HTTPS.

---

## 📂 Repository Structure

```text
├── backend/                # 🛠️ C# .NET 10 WebAPI Backend (Auth, RSA Issuance, Concurrency Locks, Device Cleaning Logic)
├── frontend/               # 💻 Next.js 16 Static Frontend (Charts Dashboard, License Generation Panel, Passkey, etc.)
├── docs/                   # 📚 Core Documentation Library (Dev Guides, Architecture, API Specs)
│   ├── architecture_and_workflow.md
│   ├── disaster_recovery_and_backup.md
│   ├── local_network_deployment_guide.md
│   └── production_server_deployment_and_security.md
├── docker-compose.yml      # 🐳 One-Click Production Deployment Compose (Forced HTTPS Public Access)
├── docker-compose.lan.yml  # 🏠 LAN-Only Deployment Compose (HTTP Port 8080, Testing Only)
├── .env.example            # ⚙️ Production Environment Configuration Template
├── README.md               # 📖 Project Home Description (English)
└── README_zh.md            # 📖 Project Home Description (Chinese)
```

---

## 🚀 Quick Start

### 1. Read the Documentation

It is highly recommended that you consult the [`docs/`](./docs) directory before performing any operations.
👉 Highly Recommended First Read: **[Core Architecture, Workflow & API Integration Guide](./docs/architecture_and_workflow.md)**

### 2. Deploy to Server (Production Environment)

Prepare a Linux server with Docker installed, and you can launch the complete business chain in just a few steps:

1. Clone this repository.
2. Copy and configure the `.env` environment variables file: `cp .env.example .env` (adjust configuration according to your environment).
   > **💡 Tip**: Upon first launch, the system will automatically create a super admin account for you using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`, and issue a default RSA key pair.
3. **Configure SSL Certificates (Mandatory)**: Since Next.js and Passkey (WebAuthn) strictly rely on secure contexts, the production environment must use HTTPS.
   - **In production, please place valid `cert.pem` and `key.pem` from recognized authorities into the `ssl` folder in the root directory.**
   - If only used for public network testing, you can run the one-click script we prepared to generate self-signed certificates (`bash generate-ssl.sh`), otherwise Nginx will crash.
4. Execute the startup command:
   ```bash
   docker-compose up -d --build
   ```

### 3. LAN-Only Testing Deployment (No Public Network)

If you are testing entirely within a company LAN and cannot configure domains or HTTPS, we have prepared a pure HTTP, non-encrypted **zero-configuration deployment plan** (Note: Passkey functionality is unavailable over HTTP):

1. Copy the LAN environment file: `cp .env.lan.example .env.lan`
2. Start using the dedicated configuration:
   ```bash
   docker-compose -f docker-compose.lan.yml --env-file .env.lan up -d --build
   ```
> This configuration uses direct local disk mapping (`data/db` and `data/keys`), ensuring that even if the database container is deleted, it can be perfectly restored. It is completely physically isolated from the public network version and will not interfere with it.

---

## 🛡️ Client Integration Compliance Advice

This system provides unbreakable server-side issuance and verification capabilities. However, to achieve a complete software commercial loop, **when integrating your client software (desktop apps/plugins, etc.)**, we strongly recommend adding:
1. **VMP Packing / Code Obfuscation**: Prevent crackers from decompiling to extract the public key or skipping the verification logic.
2. **Device Fingerprint Obfuscation**: Collect multi-dimensional information such as Motherboard/CPU/MAC address and hash them to serve as the `HardwareId`.
3. **Strong Local RSA Signature Verification**: Use the public key generated in our backend to perform rigorous offline signature verification on the License content returned by the server.

> [!IMPORTANT]
> Your software only needs to send JSON: `{ "licenseKey": "...", "hardwareId": "..." }` to complete intelligent binding, without requiring the user to input any personal information.

---

🎉 Wishing your commercial software great success!
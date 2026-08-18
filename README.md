<div align="center">

# 🛡️ Enterprise License Activation System (B2B2C)

**A rock-solid, high-performance licensing solution designed for commercial software distribution.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](#)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg?style=for-the-badge&logo=dotnet)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-black.svg?style=for-the-badge&logo=next.js)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1.svg?style=for-the-badge&logo=postgresql)](#)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=for-the-badge&logo=docker)](#)
[![Security](https://img.shields.io/badge/Security-Passkey_%7C_RSA_2048-success.svg?style=for-the-badge)](#)

<br/>

[🌍 English](./README.md) • [🌏 中文文档](./README_zh.md)

<br/>

<p align="center">
  Welcome to the <b>Enterprise License Activation System</b>! This system is specifically designed for commercial software utilizing a <b>B2B2C (Channel Distribution/E-commerce)</b> model. It perfectly separates the business boundaries between Administrator Management and End-User Activation. Employing the most rigorous encryption strategies and a modernized full-stack architecture, it protects your software IP, making licensing, authorization, and device management rock-solid.
</p>

</div>

---

## ✨ Core Enterprise Features

> [!TIP]
> **Tailored for License Distributors & Resellers**: End-users **do not need to provide an email or register** during activation. A single license key and a hardware footprint are all that's required for one-click binding. This minimizes the barrier to entry for end consumers!

- 🔄 **Auto-Revoke & Device Transfer**: Supports configuring "Max Devices" and "Max Activations (Transfers)" for license keys. When a user activates on a new device, if all slots are full but transfers are allowed, the system will **automatically revoke the oldest device**.
- 🔐 **Zero-Exposure Cryptographic Security (Offline RSA Anti-Tampering)**: The database only stores the SHA256 hash of the license keys. Offline client-side verification uses a 2048-bit `RSA + SHA256` digital signature mechanism, fundamentally preventing crackers from forging or tampering with expiration dates.
- 📱 **Hardware-Level Passwordless Authentication (Passkey & WebAuthn)**: In addition to traditional passwords, the admin dashboard fully supports modernized **Passkey (Biometrics/FaceID)** logins, reducing the risk of internal admin account theft to the lowest physical level.
- 🛡️ **Anti-Brute Force & Concurrent Login Prevention**: Supports **auto-kick** for the same super admin account logged in from multiple locations. Built-in brute-force prevention locks the account for 15 minutes after 3 consecutive incorrect password attempts.
- 📊 **High-Performance Analytics Dashboard & Security Center**: Features a graphical admin dashboard (`/admin`) for **Quick RSA Public Key Access** and tracking **Intercepted Attack Volumes** in real-time. Supports generating thousands of keys in a single second and features a dedicated **Security Center** tracking all admin operations (including Passkey login IPs) and malicious intercept logs.
- 🛡️ **Strict Environment Isolation & Testing Privileges**: A standalone `/test-activation` page is crafted specifically for commercial testing, offering privileged functions like one-click unbinding, randomizing hardware IDs, and forcing activation resets. All privileged APIs (`ResetActivations`, `Deactivate`, etc.) are heavily guarded by `[SessionAuth]`, physically and logically isolated from the production `Activate` API to firmly prevent privilege abuse.
- 🧩 **Case-Insensitive Serialization Resilience**: The frontend communication layer is fully fortified to natively adapt to mixed server responses (e.g., handling both `PascalCase` and `camelCase` payloads). This completely eliminates deserialization anomalies between WebAPI and frontend `JSON.parse()` during heterogeneous interactions.
- 🚀 **Extreme Lightweight & Full-Stack Optimization**: The frontend uses Next.js 16 (Static Export) for static building. The backend uses a tiny .NET Alpine image, integrating **IMemoryCache** for high-speed memory caching and Entity Framework no-tracking query optimizations.
- 🐳 **Containerized Black-Box Defense**: Deployed via Docker Compose, database and backend API ports are completely sealed within a virtual intranet. The only external window is strictly guarded by Nginx, with forced full-chain HTTPS.

---

## 📂 Repository Structure

```text
├── backend/                # 🛠️ C# .NET 10 WebAPI Backend (Auth, RSA, Locks, Device Logic)
├── frontend/               # 💻 Next.js 16 Static Frontend (Dashboard, License Gen, Passkey)
├── docs/                   # 📚 Core Documentation Library
│   ├── architecture_and_workflow.md
│   ├── disaster_recovery_and_backup.md
│   ├── local_network_deployment_guide.md
│   └── production_server_deployment_and_security.md
├── docker-compose.yml      # 🐳 One-Click Production Deployment (Forced HTTPS)
├── docker-compose.lan.yml  # 🏠 LAN-Only Deployment Compose (HTTP 8080, Testing Only)
├── .env.example            # ⚙️ Production Environment Configuration Template
├── README.md               # 📖 Project Home Description (English)
└── README_zh.md            # 📖 Project Home Description (Chinese)
```

---

## 🚀 Quick Start

### 1. Read the Documentation

It is highly recommended that you consult the [`docs/`](./docs) directory before performing any operations.
👉 **Highly Recommended First Read**: **[Core Architecture, Workflow & API Integration Guide](./docs/architecture_and_workflow.md)**

### 2. Deploy to Server (Production Environment)

Prepare a Linux server with Docker installed, and launch the complete business chain in just a few steps:

1. Clone this repository.
2. Copy and configure the `.env` file: `cp .env.example .env`.
   > **💡 Tip**: Upon first launch, the system will automatically create a super admin account for you using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`, and issue a default RSA key pair.
3. **Configure SSL Certificates (Mandatory)**: Since Next.js and Passkey strictly rely on secure contexts, the production environment must use HTTPS.
   - **In production, place valid `cert.pem` and `key.pem` from recognized authorities into the `ssl` folder.**
   - If only testing on public network, run `bash generate-ssl.sh` to generate self-signed certificates, otherwise Nginx will crash.
4. Execute the startup command:
   ```bash
   docker-compose up -d --build
   ```

### 3. LAN-Only Testing Deployment (No Public Network)

If testing entirely within a company LAN without domains or HTTPS, we have prepared a pure HTTP **zero-configuration deployment plan** (Note: Passkey functionality is unavailable over HTTP):

1. Copy the LAN environment file: `cp .env.lan.example .env.lan`
2. Start using the dedicated configuration:
   ```bash
   docker-compose -f docker-compose.lan.yml --env-file .env.lan up -d --build
   ```
> This configuration uses direct local disk mapping (`data/db` and `data/keys`). It is completely physically isolated from the public network version and will not interfere with it.

---

## 🛡️ Client Integration Compliance Advice

This system provides unbreakable server-side issuance and verification capabilities. However, to achieve a complete software commercial loop, **when integrating your client software**, we strongly recommend adding:

1. **VMP Packing / Code Obfuscation**: Prevent crackers from decompiling to extract the public key or skipping the verification logic.
2. **Device Fingerprint Obfuscation**: Collect multi-dimensional information such as Motherboard/CPU/MAC address and hash them to serve as the `HardwareId`.
3. **Strong Local RSA Signature Verification**: Use the public key generated in our backend to perform rigorous offline signature verification on the License content returned by the server.

> [!IMPORTANT]
> Your software only needs to send JSON: `{ "licenseKey": "...", "hardwareId": "..." }` to complete intelligent binding, without requiring the user to input any personal information.

---

<div align="center">
  <b>🎉 Wishing your commercial software great success!</b>
</div>
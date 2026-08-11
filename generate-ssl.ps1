$sslPath = "ssl"
if (!(Test-Path -Path $sslPath)) {
    New-Item -ItemType Directory -Path $sslPath | Out-Null
}

Write-Host "Generating self-signed SSL certificates..."

try {
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "$sslPath\key.pem" -out "$sslPath\cert.pem" -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
    Write-Host "Certificates generated successfully. You can now run docker-compose up -d"
} catch {
    Write-Host "Error: OpenSSL not found. Please manually place cert.pem and key.pem in the ssl folder."
}

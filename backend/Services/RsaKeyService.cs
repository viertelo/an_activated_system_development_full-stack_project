using System.Security.Cryptography;
using System.IO;
using System.Text.Json;
using System.Text;

namespace backend.Services
{
    public class RsaKeyService
    {
        private readonly string _keysDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Keys");
        private readonly string _privateKeyPath;
        private readonly string _publicKeyPath;
        private RSA _rsa;

        public RsaKeyService()
        {
            _privateKeyPath = Path.Combine(_keysDirectory, "private_key.pem");
            _publicKeyPath = Path.Combine(_keysDirectory, "public_key.pem");
            _rsa = RSA.Create();
            EnsureKeysExist();
        }

        private void EnsureKeysExist()
        {
            if (!Directory.Exists(_keysDirectory))
            {
                Directory.CreateDirectory(_keysDirectory);
            }

            if (File.Exists(_privateKeyPath) && File.Exists(_publicKeyPath))
            {
                // Load existing keys
                var privateKeyPem = File.ReadAllText(_privateKeyPath);
                _rsa.ImportFromPem(privateKeyPem);
            }
            else
            {
                // Generate new keys (2048-bit)
                _rsa = RSA.Create(2048);
                
                var privateKeyPem = _rsa.ExportRSAPrivateKeyPem();
                var publicKeyPem = _rsa.ExportRSAPublicKeyPem();

                File.WriteAllText(_privateKeyPath, privateKeyPem);
                File.WriteAllText(_publicKeyPath, publicKeyPem);
            }
        }

        /// <summary>
        /// 获取公钥 (提供给客户端下载)
        /// </summary>
        public string GetPublicKeyPem()
        {
            return File.ReadAllText(_publicKeyPath);
        }

        /// <summary>
        /// 使用私钥对待签数据进行签名
        /// </summary>
        public string SignData(object payload)
        {
            var json = JsonSerializer.Serialize(payload);
            var dataBytes = Encoding.UTF8.GetBytes(json);
            
            var signatureBytes = _rsa.SignData(dataBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            var signatureBase64 = System.Convert.ToBase64String(signatureBytes);
            
            var payloadBase64 = System.Convert.ToBase64String(dataBytes);
            
            // 返回格式： PayloadBase64.SignatureBase64 
            // 客户端收到后，切分字符串，用公钥验证 PayloadBase64 解析出的 Bytes 是否匹配 SignatureBase64 解出的 Bytes
            return $"{payloadBase64}.{signatureBase64}";
        }
    }
}

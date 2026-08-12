using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace backend.Models
{
    public class FidoStoredCredential
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        public byte[] UserId { get; set; } = Array.Empty<byte>();

        [Required]
        public byte[] PublicKey { get; set; } = Array.Empty<byte>();

        [Required]
        public byte[] UserHandle { get; set; } = Array.Empty<byte>();

        [Required]
        public uint SignatureCounter { get; set; }

        [Required]
        public string CredType { get; set; } = string.Empty;

        public DateTime RegDate { get; set; } = DateTime.UtcNow;

        [Required]
        public Guid AaGuid { get; set; }

        [Required]
        public byte[] CredentialId { get; set; } = Array.Empty<byte>();

        // 导航属性
        [ForeignKey("UserEntity")]
        public Guid UserEntityId { get; set; }
        
        [JsonIgnore]
        public User? UserEntity { get; set; }
    }
}

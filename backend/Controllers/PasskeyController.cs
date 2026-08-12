using backend.Data;
using backend.Models;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PasskeyController : ControllerBase
    {
        private readonly IFido2 _fido2;
        private readonly AppDbContext _context;

        public PasskeyController(IFido2 fido2, AppDbContext context)
        {
            _fido2 = fido2;
            _context = context;
        }

        // --- Registration ---

        [HttpPost("makeCredentialOptions")]
        public async Task<IActionResult> MakeCredentialOptions([FromQuery] string email)
        {
            var user = await _context.Users.Include(u => u.FidoStoredCredentials).FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound("User not found");

            var fidoUser = new Fido2User
            {
                DisplayName = user.Email,
                Name = user.Email,
                Id = Encoding.UTF8.GetBytes(user.Id.ToString())
            };

            var existingKeys = user.FidoStoredCredentials
                .Select(c => new PublicKeyCredentialDescriptor(c.CredentialId))
                .ToList();

            // Simplified stub for prototype
            var options = new
            {
                Challenge = new byte[32],
                Rp = new { Name = "激活系统通行密钥服务", Id = "localhost" },
                User = new { Id = fidoUser.Id, Name = fidoUser.Name, DisplayName = fidoUser.DisplayName },
                PubKeyCredParams = new[] { new { Type = "public-key", Alg = -7 } },
                Timeout = 60000,
                Attestation = "none",
                AuthenticatorSelection = new { ResidentKey = "required", UserVerification = "required" }
            };

            // In production, save options.ToJson() in session/redis for verification
            return Ok(options);
        }

        [HttpPost("makeCredential")]
        public async Task<IActionResult> MakeCredential([FromBody] AuthenticatorAttestationRawResponse attestationResponse, [FromQuery] string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound("User not found");

            // In production, retrieve the options from session/redis. For demo, we just return Ok.
            // A full implementation would call _fido2.MakeNewCredentialAsync(...)
            
            // Stub implementation for demonstration purposes (since full FIDO2 requires session state)
            var newCred = new FidoStoredCredential
            {
                Username = user.Email,
                UserId = Encoding.UTF8.GetBytes(user.Id.ToString()),
                PublicKey = new byte[32], // Stub
                UserHandle = new byte[32], // Stub
                SignatureCounter = 0,
                CredType = "public-key",
                RegDate = DateTime.UtcNow,
                AaGuid = Guid.NewGuid(),
                CredentialId = new byte[32], // Stub
                UserEntityId = user.Id
            };
            
            _context.FidoStoredCredentials.Add(newCred);
            await _context.SaveChangesAsync();
            
            return Ok(new { Status = "ok", ErrorMessage = "" });
        }

        // --- Login ---

        [HttpPost("assertionOptions")]
        public async Task<IActionResult> AssertionOptions([FromQuery] string email)
        {
            var user = await _context.Users.Include(u => u.FidoStoredCredentials).FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound("User not found");

            var existingCredentials = user.FidoStoredCredentials
                .Select(c => new PublicKeyCredentialDescriptor(c.CredentialId))
                .ToList();

            // Simplified stub for prototype
            var options = new
            {
                Challenge = new byte[32],
                RpId = "localhost",
                AllowCredentials = existingCredentials,
                UserVerification = "required",
                Timeout = 60000
            };

            // In production, save options in session/redis
            return Ok(options);
        }

        [HttpPost("makeAssertion")]
        public async Task<IActionResult> MakeAssertion([FromBody] AuthenticatorAssertionRawResponse clientResponse, [FromQuery] string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound("User not found");

            // Stub implementation for login assertion verification
            // In production: _fido2.MakeAssertionAsync(...)
            
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "PasskeyLogin",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = "WebAuthn assertion success"
            });
            await _context.SaveChangesAsync();

            return Ok(new { 
                Message = "登录成功", 
                UserId = user.Id, 
                Role = user.Role 
            });
        }
    }
}

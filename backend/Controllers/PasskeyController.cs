using backend.Data;
using backend.Models;
using backend.Filters;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [SessionAuth]
    public class PasskeyController : ControllerBase
    {
        private readonly IFido2 _fido2;
        private readonly AppDbContext _context;

        public PasskeyController(IFido2 fido2, AppDbContext context)
        {
            _fido2 = fido2;
            _context = context;
        }

        private string FormatOptionsSessionKey(Guid userId) => $"fido2_options_{userId}";
        private string FormatOptionsSessionKey(string email) => $"fido2_options_{email}";

        // --- Registration ---

        [HttpPost("makeCredentialOptions")]
        public async Task<IActionResult> MakeCredentialOptions([FromQuery] Guid userId)
        {
            var user = await _context.Users.AsNoTracking().Include(u => u.FidoStoredCredentials).FirstOrDefaultAsync(u => u.Id == userId);
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

            var authenticatorSelection = new AuthenticatorSelection
            {
                ResidentKey = ResidentKeyRequirement.Required,
                UserVerification = UserVerificationRequirement.Required
            };

            var options = _fido2.RequestNewCredential(new RequestNewCredentialParams
            {
                User = fidoUser,
                ExcludeCredentials = existingKeys,
                AuthenticatorSelection = authenticatorSelection,
                AttestationPreference = AttestationConveyancePreference.None
            });

            HttpContext.Session.SetString(FormatOptionsSessionKey(userId), options.ToJson());

            return Ok(options);
        }

        [HttpPost("makeCredential")]
        public async Task<IActionResult> MakeCredential([FromBody] AuthenticatorAttestationRawResponse attestationResponse, [FromQuery] Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound("User not found");

            var jsonOptions = HttpContext.Session.GetString(FormatOptionsSessionKey(userId));
            if (string.IsNullOrEmpty(jsonOptions))
            {
                return BadRequest("Invalid session or session expired.");
            }

            var options = CredentialCreateOptions.FromJson(jsonOptions);

            IsCredentialIdUniqueToUserAsyncDelegate callback = async (args, cancellationToken) =>
            {
                var usersWithCred = await _context.FidoStoredCredentials
                    .Where(c => c.CredentialId == args.CredentialId)
                    .ToListAsync();
                return !usersWithCred.Any();
            };

            var success = await _fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
            {
                AttestationResponse = attestationResponse,
                OriginalOptions = options,
                IsCredentialIdUniqueToUserCallback = callback
            }, cancellationToken: CancellationToken.None);

            var newCred = new FidoStoredCredential
            {
                Username = user.Email,
                UserId = Encoding.UTF8.GetBytes(user.Id.ToString()),
                PublicKey = success.PublicKey,
                UserHandle = success.User.Id,
                SignatureCounter = success.SignCount,
                CredType = "public-key", // Assuming default string here
                RegDate = DateTime.UtcNow,
                AaGuid = success.AaGuid,
                CredentialId = success.Id,
                UserEntityId = user.Id
            };

            _context.FidoStoredCredentials.Add(newCred);
            await _context.SaveChangesAsync();

            // Clear session
            HttpContext.Session.Remove(FormatOptionsSessionKey(userId));

            return Ok(new { Status = "ok", ErrorMessage = "" });
        }

        // --- Login ---

        [HttpPost("assertionOptions")]
        public async Task<IActionResult> AssertionOptions([FromQuery] string email)
        {
            var user = await _context.Users.AsNoTracking().Include(u => u.FidoStoredCredentials).FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                return NotFound(new { Message = "未找到该用户。" });
            }

            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
            {
                var remainingMinutes = (int)(user.LockoutEnd.Value - DateTime.UtcNow).TotalMinutes + 1;
                return Unauthorized(new { Message = $"密码错误次数过多，账号已锁定，请 {remainingMinutes} 分钟后再试。" });
            }

            var existingCredentials = user.FidoStoredCredentials.Select(c => new PublicKeyCredentialDescriptor(c.CredentialId)).ToList();
            if (!existingCredentials.Any())
            {
                return BadRequest(new { Message = "该账号未绑定任何通行密钥。" });
            }

            var options = _fido2.GetAssertionOptions(new GetAssertionOptionsParams
            {
                AllowedCredentials = existingCredentials,
                UserVerification = UserVerificationRequirement.Required
            });

            HttpContext.Session.SetString(FormatOptionsSessionKey(email), options.ToJson());

            return Ok(options);
        }

        [HttpPost("makeAssertion")]
        public async Task<IActionResult> MakeAssertion([FromBody] AuthenticatorAssertionRawResponse clientResponse, [FromQuery] string email)
        {
            var user = await _context.Users.Include(u => u.FidoStoredCredentials).FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return NotFound("User not found");

            var jsonOptions = HttpContext.Session.GetString(FormatOptionsSessionKey(email));
            if (string.IsNullOrEmpty(jsonOptions))
            {
                return BadRequest("Invalid session or session expired.");
            }

            var options = Fido2NetLib.AssertionOptions.FromJson(jsonOptions);

            var clientResponseIdBytes = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(clientResponse.Id);
            var storedCred = user.FidoStoredCredentials.FirstOrDefault(c => c.CredentialId.SequenceEqual(clientResponseIdBytes));
            if (storedCred == null)
            {
                return BadRequest("Unknown credential");
            }

            IsUserHandleOwnerOfCredentialIdAsync callback = async (args, cancellationToken) =>
            {
                return storedCred.UserHandle.SequenceEqual(args.UserHandle);
            };

            var success = await _fido2.MakeAssertionAsync(new MakeAssertionParams
            {
                AssertionResponse = clientResponse,
                OriginalOptions = options,
                StoredPublicKey = storedCred.PublicKey,
                StoredSignatureCounter = storedCred.SignatureCounter,
                IsUserHandleOwnerOfCredentialIdCallback = callback
            }, cancellationToken: CancellationToken.None);

            // Update counter
            storedCred.SignatureCounter = success.SignCount;

            // Reset lockout and issue Session Token
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;
            user.CurrentSessionToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "PasskeyLogin",
                Operator = user.Email,
                Target = $"UserId:{user.Id}",
                IsSuccess = true,
                Details = $"[IP: {ip}] WebAuthn assertion success"
            });

            await _context.SaveChangesAsync();

            // Clear session
            HttpContext.Session.Remove(FormatOptionsSessionKey(email));

            return Ok(new { 
                Message = "登录成功", 
                UserId = user.Id, 
                Role = user.Role,
                SessionToken = user.CurrentSessionToken
            });
        }
    }
}

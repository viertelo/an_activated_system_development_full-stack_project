using System;
using System.IO;
using System.IO.Compression;

class Program {
    static void Main() {
        var bytes = System.Text.Encoding.UTF8.GetBytes("hello world");
        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            var zipEntry = archive.CreateEntry("public_key.pem");
            using var entryStream = zipEntry.Open();
            entryStream.Write(bytes, 0, bytes.Length);
        }
        memoryStream.Position = 0;
        var arr = memoryStream.ToArray();
        Console.WriteLine("Size: " + arr.Length);
    }
}

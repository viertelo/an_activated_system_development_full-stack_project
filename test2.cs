using System;

class MyDisposable : IDisposable
{
    private readonly string _name;
    public MyDisposable(string name) { _name = name; Console.WriteLine($"{_name} created"); }
    public void Dispose() { Console.WriteLine($"{_name} disposed"); }
}

class Program
{
    static void Main()
    {
        using (var a = new MyDisposable("archive"))
        {
            using var e = new MyDisposable("entry");
            Console.WriteLine("inside block");
        }
        Console.WriteLine("outside block");
    }
}

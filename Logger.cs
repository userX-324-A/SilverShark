using System;
using System.IO;

namespace SilverShark; // Add namespace

public static class Logger
{
    private static readonly string LogFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "native_host_log.txt");
    private static readonly object LockObj = new object();

    public static void Log(string message)
    {
        try
        {
            lock (LockObj)
            {
                File.AppendAllText(LogFilePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}");
            }
        }
        catch (Exception)
        {
            // Ignore logging errors
        }
    }
} 
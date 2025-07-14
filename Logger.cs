using System;
using System.IO;

namespace SilverShark; // Add namespace

public static class Logger
{
    private static readonly string LogFilePath;
    private static readonly object LockObj = new object();

    static Logger()
    {
        try
        {
            string appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string logDirectory = Path.Combine(appDataPath, "SilverShark");
            Directory.CreateDirectory(logDirectory);
            LogFilePath = Path.Combine(logDirectory, "native_host_log.txt");
        }
        catch (Exception)
        {
            // If creating the log directory/path fails, logging will be disabled.
            LogFilePath = null;
        }
    }

    public static void Log(string message)
    {
        if (string.IsNullOrEmpty(LogFilePath))
        {
            return; // Logging is disabled.
        }

        try
        {
            lock (LockObj)
            {
                File.AppendAllText(LogFilePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}");
            }
        }
        catch (Exception)
        {
            // Ignore logging errors to prevent the host from crashing.
        }
    }
} 
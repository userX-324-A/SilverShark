using System.Text.Json;

namespace SilverShark.Models;

// Message from Extension
public class ExtensionMessage
{
    public string command { get; set; }
    // Using JsonElement allows flexibility in what the 'params' object can contain
    public JsonElement @params { get; set; } // Use @ to allow 'params' as a C# property name
} 
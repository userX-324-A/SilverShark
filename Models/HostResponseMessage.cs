using System.Text.Json;
using System.Collections.Generic;

namespace SilverShark.Models;

// Message to Extension
public class HostResponseMessage
{
    public string status { get; set; }
    public string received_command { get; set; }
    public JsonElement original_params { get; set; }
    public string message { get; set; }
    public string filePath { get; set; } // Added for file path response
    public List<ExcelRow> excelData { get; set; } // Added for Excel data response
} 
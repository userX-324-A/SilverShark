using System.Text.Json;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SilverShark.Models;

// Message to Extension
public class HostResponseMessage
{
    public string status { get; set; }
    public string received_command { get; set; }
    [JsonIgnore]
    public JsonElement original_params { get; set; }
    public string message { get; set; }
    public string filePath { get; set; }
    public List<ExcelRow> data { get; set; }
} 
namespace SilverShark.Models;

// New class to hold structured Excel row data
public class ExcelRow
{
    public string Application { get; set; }
    public string Account { get; set; }
    public string TranCode { get; set; }
    public string Description { get; set; }
    public decimal? Amount { get; set; } // Using decimal? for currency
    public string EffectiveDate { get; set; } // String for formatted date
    public string SerialNumber { get; set; }
    public string Branch { get; set; }
    public string Center { get; set; }
} 
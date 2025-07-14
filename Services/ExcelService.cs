using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using SilverShark.Models; // Assuming ExcelRow is in SilverShark.Models
using ClosedXML.Excel;
using SilverShark; // Added for Logger

namespace SilverShark.Services;

public class ExcelService
{
    // Define a class or a tuple to return both data and potential error messages.
    public class ExcelProcessingResult
    {
        public List<SilverShark.Models.ExcelRow> Data { get; set; }
        public string ErrorMessage { get; set; }
        public bool IsSuccess => string.IsNullOrEmpty(ErrorMessage);

        public ExcelProcessingResult(List<SilverShark.Models.ExcelRow> data)
        {
            Data = data;
        }

        public ExcelProcessingResult(string errorMessage)
        {
            ErrorMessage = errorMessage;
        }
    }

    public ExcelProcessingResult ProcessExcelFile(string filePath)
    {
        Logger.Log($"Processing Excel file in ExcelService: {filePath}");
        List<SilverShark.Models.ExcelRow> data = new List<SilverShark.Models.ExcelRow>();

        try
        {
            using (var workbook = new XLWorkbook(filePath))
            {
                var worksheet = workbook.Worksheets.FirstOrDefault();
                if (worksheet == null)
                {
                    Logger.Log("No worksheet found in the Excel file.");
                    return new ExcelProcessingResult("No worksheet found in the Excel file.");
                }

                if (worksheet.LastCellUsed() == null || worksheet.LastCellUsed().Address.RowNumber < 1) // Check if the worksheet is empty or has no data rows
                {
                    Logger.Log("Worksheet is empty or dimension could not be determined.");
                    return new ExcelProcessingResult("Worksheet is empty or dimension is null.");
                }

                // Find the header row (assuming it's the first row with content)
                var firstRowWithData = worksheet.FirstRowUsed();
                if (firstRowWithData == null)
                {
                    Logger.Log("Worksheet is empty.");
                    return new ExcelProcessingResult("Worksheet is empty.");
                }

                int headerRowIndex = firstRowWithData.RowNumber();
                var headerCells = worksheet.Row(headerRowIndex).CellsUsed();
                var columnMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                foreach (var cell in headerCells)
                {
                    var columnName = cell.Value.ToString()?.Trim().Replace(" ", "");
                    if (!string.IsNullOrEmpty(columnName) && !columnMap.ContainsKey(columnName))
                    {
                        columnMap[columnName] = cell.Address.ColumnNumber;
                    }
                }

                string[] baseRequiredColumns = {
                    nameof(SilverShark.Models.ExcelRow.Application),
                    nameof(SilverShark.Models.ExcelRow.Account),
                    nameof(SilverShark.Models.ExcelRow.TranCode),
                    nameof(SilverShark.Models.ExcelRow.Description),
                    nameof(SilverShark.Models.ExcelRow.Amount),
                    nameof(SilverShark.Models.ExcelRow.EffectiveDate)
                };

                var missingBaseColumns = baseRequiredColumns
                    .Where(rc => !columnMap.Keys.Any(k => k.Equals(rc.Replace(" ", ""), StringComparison.OrdinalIgnoreCase)))
                    .ToList();

                if (missingBaseColumns.Any())
                {
                    Logger.Log($"One or more required columns are missing from the Excel file: {string.Join(", ", missingBaseColumns)}");
                    return new ExcelProcessingResult($"The following required columns are missing: {string.Join(", ", missingBaseColumns)}");
                }

                string[] glRequiredColumns = {
                    nameof(SilverShark.Models.ExcelRow.Branch),
                    nameof(SilverShark.Models.ExcelRow.Center)
                };

                for (int rowNum = headerRowIndex + 1; rowNum <= worksheet.LastRowUsed().RowNumber(); rowNum++)
                {
                    SilverShark.Models.ExcelRow rowData = new SilverShark.Models.ExcelRow();
                    bool rowHasData = false;
                    var currentRow = worksheet.Row(rowNum);

                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Application).Replace(" ", ""), out int appCol)) { rowData.Application = currentRow.Cell(appCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.Application)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Account).Replace(" ", ""), out int accCol)) { rowData.Account = currentRow.Cell(accCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.Account)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.TranCode).Replace(" ", ""), out int tranCol)) { rowData.TranCode = currentRow.Cell(tranCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.TranCode)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Description).Replace(" ", ""), out int descCol)) { rowData.Description = currentRow.Cell(descCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.Description)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.SerialNumber).Replace(" ", ""), out int serialCol)) { rowData.SerialNumber = currentRow.Cell(serialCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.SerialNumber)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Branch).Replace(" ", ""), out int branchCol)) { rowData.Branch = currentRow.Cell(branchCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.Branch)) rowHasData = true; }
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Center).Replace(" ", ""), out int centerCol)) { rowData.Center = currentRow.Cell(centerCol).GetString()?.Trim(); if (!string.IsNullOrEmpty(rowData.Center)) rowHasData = true; }

                    if ("GL".Equals(rowData.Application, StringComparison.OrdinalIgnoreCase))
                    {
                        var missingGlColumns = glRequiredColumns
                            .Where(rc => !columnMap.Keys.Any(k => k.Equals(rc.Replace(" ", ""), StringComparison.OrdinalIgnoreCase)))
                            .ToList();

                        if (missingGlColumns.Any())
                        {
                            var error = $"For 'GL' applications, the following columns are required but were not found: {string.Join(", ", missingGlColumns)}";
                            Logger.Log(error);
                            return new ExcelProcessingResult(error);
                        }

                        if (string.IsNullOrWhiteSpace(rowData.Branch) || string.IsNullOrWhiteSpace(rowData.Center))
                        {
                            var error = $"Row {rowNum}: For 'GL' applications, Branch and Center values are required.";
                            Logger.Log(error);
                            return new ExcelProcessingResult(error);
                        }
                    }

                    // Handling dates and decimal with robust parsing
                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.EffectiveDate).Replace(" ", ""), out int effDateCol))
                    {
                        var effDateCell = currentRow.Cell(effDateCol);
                        if (effDateCell.TryGetValue<DateTime>(out DateTime effDate))
                        {
                            rowData.EffectiveDate = effDate.ToString("MM/dd/yyyy");
                        }
                        else if (DateTime.TryParse(effDateCell.GetString()?.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out effDate))
                        {
                            rowData.EffectiveDate = effDate.ToString("MM/dd/yyyy");
                        }
                         if(!String.IsNullOrEmpty(rowData.EffectiveDate)) rowHasData = true;
                    }

                    if (columnMap.TryGetValue(nameof(SilverShark.Models.ExcelRow.Amount).Replace(" ", ""), out int amountCol))
                    {
                        var amountCell = currentRow.Cell(amountCol);
                        if (amountCell.TryGetValue<decimal>(out decimal amount))
                        {
                            rowData.Amount = amount;
                        }
                        else if (decimal.TryParse(amountCell.GetString()?.Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out amount))
                        {
                            rowData.Amount = amount;
                        }
                         if(rowData.Amount.HasValue) rowHasData = true;
                    }

                    if (rowHasData)
                    {
                        data.Add(rowData);
                        Logger.Log($"Added row to data: App='{rowData.Application}', Account='{rowData.Account}', Desc='{rowData.Description}', Serial='{rowData.SerialNumber}', Branch='{rowData.Branch}', Center='{rowData.Center}', EffDate='{rowData.EffectiveDate}', Amount='{rowData.Amount}'");
                    }
                    else
                    {
                        Logger.Log($"Skipped empty or invalid row at number {rowNum}.");
                    }
                }

                Logger.Log($"Successfully processed {data.Count} rows from the Excel file.");
                return new ExcelProcessingResult(data);
            }
        }
        catch (Exception ex)
        {
            Logger.Log($"Error processing Excel file: {ex.Message}");
            return new ExcelProcessingResult($"An error occurred while processing the file: {ex.Message}");
        }
    }
} 
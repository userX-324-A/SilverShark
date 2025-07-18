using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using SilverShark.Models;
using SilverShark.Services;
using System.Text.Json.Serialization; // For JsonIgnoreCondition

namespace SilverShark // Ensure Program class is in a namespace
{
    public class SilverSharkApplication // Renamed from Program
    {
        private static FileDialogService _fileDialogService;
        private static ExcelService _excelService;

        [STAThread]
        public static void Main(string[] args)
        {
            _fileDialogService = new FileDialogService();
            _excelService = new ExcelService();

            Logger.Log("Native host started.");
            try
            {
                while (true)
                {
                    string rawMessage = ReadMessage(Console.OpenStandardInput());
                    if (string.IsNullOrEmpty(rawMessage))
                    {
                        Logger.Log("No message received or stdin closed. Exiting loop.");
                        break;
                    }

                    Logger.Log($"Received raw JSON: {rawMessage}");

                    ExtensionMessage incomingMessage = null;
                    try
                    {
                        incomingMessage = JsonSerializer.Deserialize<ExtensionMessage>(rawMessage);
                    }
                    catch (JsonException jsonEx)
                    {
                        Logger.Log($"JSON Deserialization Error: {jsonEx.Message}");
                        SendMessage(Console.OpenStandardOutput(), new HostResponseMessage { status = "error", message = "Malformed JSON received." });
                        continue;
                    }

                    if (incomingMessage != null)
                    {
                        Logger.Log($"Deserialized command: {incomingMessage.command}");

                        switch (incomingMessage.command)
                        {
                            case "select_excel_file_dialog":
                                HandleSelectFileDialog(Console.OpenStandardOutput(), incomingMessage);
                                break;
                            case "process_excel_file":
                                HandleProcessExcelFile(Console.OpenStandardOutput(), incomingMessage);
                                break;
                            default:
                                HandleGenericCommand(Console.OpenStandardOutput(), incomingMessage);
                                break;
                        }
                    }
                    else
                    {
                        Logger.Log("Failed to deserialize message or message was null.");
                        SendMessage(Console.OpenStandardOutput(), new HostResponseMessage { status = "error", message = "Could not process the message." });
                    }
                }
            }
            catch (IOException ioEx)
            {
                Logger.Log($"IO Exception: {ioEx.Message}. Likely the extension disconnected.");
            }
            catch (Exception ex)
            {
                Logger.Log($"Unhandled Exception: {ex.Message}{Environment.NewLine}StackTrace: {ex.StackTrace}");
                try
                {
                    SendMessage(Console.OpenStandardOutput(), new HostResponseMessage { status = "error", message = "An unexpected error occurred in the native host." });
                }
                catch (Exception sendEx)
                {
                    Logger.Log($"Failed to send final error message: {sendEx.Message}");
                }
            }
            Logger.Log("Native host shutting down.");
        }

        private static async void HandleSelectFileDialog(Stream outputStream, ExtensionMessage originalMessageFromExtension)
        {
            Logger.Log("Attempting to show open file dialog via FileDialogService.");
            try
            {
                string selectedFilePath = await _fileDialogService.ShowOpenFileDialogAsync();

                if (!string.IsNullOrEmpty(selectedFilePath))
                {
                    Logger.Log($"File selected: {selectedFilePath}. Proceeding to process directly.");

                    // Prepare to call HandleProcessExcelFile directly
                    var processParams = new ProcessExcelParams { filePath = selectedFilePath };
                    string paramsJson = JsonSerializer.Serialize(processParams);
                    JsonElement paramsJsonElement = JsonSerializer.Deserialize<JsonElement>(paramsJson);

                    ExtensionMessage processFileMessage = new ExtensionMessage
                    {
                        command = "process_excel_file", // For logging consistency
                        @params = paramsJsonElement
                    };
                    
                    // Call HandleProcessExcelFile, which now uses ExcelService
                    HandleProcessExcelFile(outputStream, processFileMessage);
                }
                else
                {
                    Logger.Log("File selection cancelled or failed.");
                    SendMessage(outputStream, new HostResponseMessage
                    {
                        status = "error",
                        message = "File selection was cancelled or failed."
                    });
                }
            }
            catch (Exception ex) // Catch exceptions from ShowOpenFileDialogAsync
            {
                Logger.Log($"Error in file dialog task: {ex.GetBaseException().Message}");
                SendMessage(outputStream, new HostResponseMessage
                {
                    status = "error",
                    message = "Error occurred during file selection dialog."
                });
            }
        }

        private static void HandleProcessExcelFile(Stream outputStream, ExtensionMessage incomingMessage)
        {
            Logger.Log("Attempting to process Excel file via ExcelService.");
            string filePath = null;
            try
            {
                var excelParams = JsonSerializer.Deserialize<ProcessExcelParams>(incomingMessage.@params.GetRawText());
                filePath = excelParams?.filePath;

                if (string.IsNullOrEmpty(filePath))
                {
                    Logger.Log("File path is null or empty in process_excel_file command.");
                    SendMessage(outputStream, new HostResponseMessage { status = "error", message = "File path not provided." });
                    return;
                }

                if (!File.Exists(filePath))
                {
                    Logger.Log($"File not found: {filePath}");
                    SendMessage(outputStream, new HostResponseMessage { status = "error", message = $"File not found: {filePath}" });
                    return;
                }

                ExcelService.ExcelProcessingResult result = _excelService.ProcessExcelFile(filePath);

                if (result.IsSuccess)
                {
                    Logger.Log($"Successfully processed {result.Data.Count} rows from Excel file.");
                    SendMessage(outputStream, new HostResponseMessage
                    {
                        status = "processed_excel_data",
                        data = result.Data,
                        message = $"Successfully processed {result.Data.Count} rows."
                    });
                }
                else
                {
                    Logger.Log($"Error processing Excel file: {result.ErrorMessage}");
                    SendMessage(outputStream, new HostResponseMessage
                    {
                        status = "error",
                        message = result.ErrorMessage
                    });
                }
            }
            catch (JsonException jsonEx)
            {
                Logger.Log($"JSON Deserialization Error for params in process_excel_file: {jsonEx.Message}");
                SendMessage(outputStream, new HostResponseMessage { status = "error", message = "Invalid parameters for processing Excel file." });
            }
            catch (Exception ex) // Catch unexpected errors during the process
            {
                Logger.Log($"Unexpected error in HandleProcessExcelFile for '{filePath}': {ex.Message}{Environment.NewLine}StackTrace: {ex.StackTrace}");
                SendMessage(outputStream, new HostResponseMessage { status = "error", message = $"Unexpected error processing Excel file: {ex.Message}" });
            }
        }

        private static void HandleGenericCommand(Stream outputStream, ExtensionMessage incomingMessage)
        {
            HostResponseMessage response = new HostResponseMessage
            {
                status = "success",
                message = $"Command '{incomingMessage.command}' received and processed by generic handler."
            };
            SendMessage(outputStream, response);
            Logger.Log($"Sent response for command: {incomingMessage.command}");
        }

        private static string ReadMessage(Stream inputStream)
        {
            byte[] lengthBytes = new byte[4];
            int bytesRead = inputStream.Read(lengthBytes, 0, 4);

            if (bytesRead == 0) return null;
            if (bytesRead < 4)
            {
                Logger.Log("Failed to read the 4-byte message length.");
                throw new IOException("Failed to read message length.");
            }

            int messageLength = BitConverter.ToInt32(lengthBytes, 0);
            Logger.Log($"Expecting message length: {messageLength}");

            if (messageLength == 0)
            {
                Logger.Log("Received 0 length message.");
                return "{}"; 
            }
            
            byte[] messageBytes = new byte[messageLength];
            int totalBytesRead = 0;
            while(totalBytesRead < messageLength)
            {
                bytesRead = inputStream.Read(messageBytes, totalBytesRead, messageLength - totalBytesRead);
                if (bytesRead == 0) throw new IOException("Stream closed prematurely while reading message body.");
                totalBytesRead += bytesRead;
            }
            
            Logger.Log($"Read {totalBytesRead} bytes for message body.");
            return Encoding.UTF8.GetString(messageBytes);
        }

        private static void SendMessage(Stream outputStream, object messageObject)
        {
            string jsonMessage = JsonSerializer.Serialize(messageObject, new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull });
            byte[] messageBytes = Encoding.UTF8.GetBytes(jsonMessage);
            byte[] lengthBytes = BitConverter.GetBytes(messageBytes.Length);

            outputStream.Write(lengthBytes, 0, 4);
            outputStream.Write(messageBytes, 0, messageBytes.Length);
            outputStream.Flush();
            Logger.Log($"Sent JSON: {jsonMessage}");
        }
    }
} 
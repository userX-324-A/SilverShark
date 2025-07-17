# SilverShark

SilverShark is a browser extension and companion application designed to streamline the process of entering transaction data into the Horizon XE banking application. It allows users to import transaction data from an Excel spreadsheet and automate the entry process into an Online Transaction Entry (OTE) batch.

## How It Works

The SilverShark solution consists of two main components:

1.  **A browser extension**: This extension runs in your web browser and interacts with the Horizon XE web application.
2.  **A companion application**: This is a native application that runs on your computer and is responsible for handling file operations, specifically reading data from Excel files.

### The Workflow

The process of using SilverShark follows these steps:

1.  **Initiate Data Loading**: The user clicks on the SilverShark extension icon in their browser, which opens a popup interface. From this popup, the user clicks the "Load Data" button.

2.  **Select Excel File**: The browser extension sends a message to the companion application, which then opens a file selection dialog. The user selects the Excel spreadsheet containing the transaction data they wish to import.

3.  **Process Spreadsheet**: The companion application reads the selected Excel file, extracts the transaction data, and sends it back to the browser extension.

4.  **Review Data**: The extension's popup window displays the imported data, allowing the user to review and navigate through the transaction records before processing.

5.  **Automated Data Entry**: Once the data is loaded and reviewed, the user can start the automated entry process. The extension's content script, which is injected into the Horizon XE application's web page, takes the data and programmatically fills out the Online Transaction Entry form, creating a new batch with the imported transactions.

This process eliminates the need for manual data entry, reducing the potential for errors and saving a significant amount of time.

## Installation

The installation process involves two parts: installing the native companion application and installing the browser extension. Both are required for SilverShark to function correctly.

### 1. Companion Application

1.  **Prerequisites**: Ensure you have **.NET Framework 4.7.2** or a later version installed on your system.
2.  Download the latest `SilverSharkInstaller.msi` from the [SilverShark GitHub Releases page](https://github.com/userX-324-A/SilverShark/releases).
3.  Run the downloaded installer and follow the on-screen instructions to complete the installation.

The installer will place the necessary application files on your computer and create a required registry key that allows Google Chrome to securely communicate with the application.

### 2. Browser Extension

The browser extension can be installed from the official Chrome Web Store.

*A link to the store listing will be provided here once it is published.*

## Usage

To use SilverShark, you first need to prepare your transaction data in an Excel spreadsheet (`.xlsx`). The first row of the spreadsheet should contain the headers for your data columns. The column headers can have spaces (e.g., "Tran Code"), as they are handled automatically.

### Excel File Fields

The following table details the columns that SilverShark can process from the Excel file.

| Field Name      | Required?       | Description                                                                                             |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `Application`   | **Yes**         | The application code for the transaction (e.g., "DD", "SV", "GL").                                      |
| `Account`       | **Yes**         | The account number for the transaction.                                                                 |
| `TranCode`      | **Yes**         | The transaction code.                                                                                   |
| `Description`   | **Yes**         | A description for the transaction.                                                                      |
| `Amount`        | **Yes**         | The transaction amount. Should be a numerical value.                                                    |
| `EffectiveDate` | Optional        | The effective date of the transaction. Will be formatted as `MM/dd/yyyy`.                               |
| `SerialNumber`  | Optional        | The serial number, check number, or other identifier for the transaction.                               |
| `Branch`        | **Conditional** | The branch number. **Required if `Application` is `GL`**.                                               |
| `Center`        | **Conditional** | The cost center number. **Required if `Application` is `GL`**.                                          |

After preparing your Excel file, you can use the extension as described in the "How It Works" section to load and process your transactions.

## Contributing

We welcome contributions and feedback! If you encounter any bugs, have a feature request, or would like to contribute to the project, please open an issue on the [GitHub Issues page](https://github.com/userX-324-A/SilverShark/issues). Please provide a detailed description of the issue or suggestion.

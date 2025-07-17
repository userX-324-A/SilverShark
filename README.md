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

The companion application is installed using a standard Windows Installer (`.msi`).

1.  **Prerequisites**: Ensure you have **.NET Framework 4.7.2** or a later version installed on your system.
2.  Run the `SilverSharkInstaller.msi` file located in the `SilverSharkInstaller/Release/` directory.
3.  Follow the on-screen instructions to complete the installation.

The installer will place the necessary application files on your computer and create a required registry key that allows Google Chrome to securely communicate with the application.

### 2. Browser Extension

1.  Open Google Chrome and navigate to the extensions page by typing `chrome://extensions` in the address bar.
2.  Enable **Developer mode** by clicking the toggle switch in the top-right corner of the page.
3.  Click the **Load unpacked** button that appears.
4.  In the file selection dialog, navigate to the root directory of this project and select the `Extension` folder.

The SilverShark extension should now appear in your list of installed extensions and be ready to use.

## Usage

To use SilverShark, you first need to prepare your transaction data in an Excel spreadsheet (`.xlsx`). The first row of the spreadsheet should contain the headers for your data columns. The column headers can have spaces (e.g., "Tran Code"), as they are handled automatically.

### Excel File Fields

The following table details the columns that SilverShark can process from the Excel file.

| Field Name      | Required?                                | Description                                                                                             |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Application`   | **Yes**                                  | The application code for the transaction (e.g., "SAV", "DDA", "GL").                                    |
| `Account`       | **Yes**                                  | The account number for the transaction.                                                                 |
| `TranCode`      | **Yes**                                  | The transaction code.                                                                                   |
| `Description`   | **Yes**                                  | A description for the transaction.                                                                      |
| `Amount`        | **Yes**                                  | The transaction amount. Should be a numerical value.                                                    |
| `EffectiveDate` | Optional                                 | The effective date of the transaction. Will be formatted as `MM/dd/yyyy`.                               |
| `SerialNumber`  | Optional                                 | The serial number, check number, or other identifier for the transaction.                               |
| `Branch`        | **Conditional** (Required if `Application` is `GL`) | The branch number. Required for General Ledger (GL) transactions.                                       |
| `Center`        | **Conditional** (Required if `Application` is `GL`) | The cost center number. Required for General Ledger (GL) transactions.                                  |

After preparing your Excel file, you can use the extension as described in the "How It Works" section to load and process your transactions.

## Contributing

Information for developers who wish to contribute to the SilverShark project.
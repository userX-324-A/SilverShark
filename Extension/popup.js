// JavaScript for popup.html

console.log("Popup script loaded.");

const NATIVE_HOST_NAME = "com.microbytes.silvershark"; // IMPORTANT: Replace with your actual native host name
let port = null;
let isConnected = false;

// Data state variables
let allExcelRecords = [];
let currentRecordIndex = -1;
let totalRecordsLoaded = 0;

// Add this near the top with other state variables
let isPaused = false;
let isProcessing = false;

// Declare UI elements at a higher scope
let startButton, pauseButton, loadDataBtn;
let prevRecordBtn, nextRecordBtn, firstRecordBtn, lastRecordBtn; // Added first/last record buttons
let connectionStatusDiv, statusDiv;
let recordCountSpan, currentRecordInfoSpan;
let appDetailSpan, accDetailSpan, tranDetailSpan, descDetailSpan, amountDetailSpan, effDateDetailSpan, serialDetailSpan;
let branchDetailSpan, centerDetailSpan; // Added for GL fields
let toggleCompleteBtn; // Added for manual completion toggle
let unmarkAllBtn, clearDataBtn; // Added for new buttons

// --- BEGINNING OF PERSISTENCE LOGIC ---
const STORAGE_KEY = "excelExtensionData";

function saveDataToStorage() {
  const dataToSave = {
    allExcelRecords: allExcelRecords,
    currentRecordIndex: currentRecordIndex,
    totalRecordsLoaded: totalRecordsLoaded
  };
  chrome.storage.local.set({ [STORAGE_KEY]: dataToSave }, function() {
    if (chrome.runtime.lastError) {
      console.error("Error saving data to local storage:", chrome.runtime.lastError);
    } else {
      console.log("Data saved to local storage:", dataToSave);
    }
  });
}

function loadDataFromStorage(callback) {
  chrome.storage.local.get([STORAGE_KEY], function(result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading data from local storage:", chrome.runtime.lastError);
      if (callback) callback(false); // Indicate failure
      return;
    }
    if (result[STORAGE_KEY]) {
      const loadedData = result[STORAGE_KEY];
      allExcelRecords = (loadedData.allExcelRecords || []).map(record => ({ ...record, completed: record.completed || false }));
      currentRecordIndex = typeof loadedData.currentRecordIndex === 'number' ? loadedData.currentRecordIndex : -1;
      totalRecordsLoaded = typeof loadedData.totalRecordsLoaded === 'number' ? loadedData.totalRecordsLoaded : 0;
      console.log("Data loaded from local storage:", loadedData);
      if (callback) callback(true); // Indicate success
    } else {
      console.log("No data found in local storage.");
      // Initialize with defaults if no data is found
      allExcelRecords = [];
      currentRecordIndex = -1;
      totalRecordsLoaded = 0;
      if (callback) callback(false); // Indicate no data found, but not an error
    }
  });
}
// --- END OF PERSISTENCE LOGIC ---

function updateConnectionStatusDisplay(message, isError = false) {
  if (connectionStatusDiv) {
    connectionStatusDiv.textContent = message;
    connectionStatusDiv.style.color = isError ? 'red' : 'green';
  }
}

function updateButtonStates() {
  const buttons = [startButton, loadDataBtn];
  buttons.forEach(button => {
    if (button) button.disabled = !isConnected;
  });
  if (pauseButton) pauseButton.disabled = !isConnected; // Or other logic for pause

  // Enable/disable navigation buttons
  if (prevRecordBtn) {
    prevRecordBtn.disabled = !isConnected || currentRecordIndex <= 0 || totalRecordsLoaded === 0;
  }
  if (nextRecordBtn) {
    nextRecordBtn.disabled = !isConnected || currentRecordIndex >= totalRecordsLoaded - 1 || totalRecordsLoaded === 0;
  }
  if (firstRecordBtn) {
    firstRecordBtn.disabled = !isConnected || currentRecordIndex <= 0 || totalRecordsLoaded === 0;
  }
  if (lastRecordBtn) {
    lastRecordBtn.disabled = !isConnected || currentRecordIndex >= totalRecordsLoaded - 1 || totalRecordsLoaded === 0;
  }
  // Enable/disable toggleCompleteBtn based on whether a record is active and connected
  if (toggleCompleteBtn) {
    toggleCompleteBtn.disabled = !isConnected || currentRecordIndex < 0 || totalRecordsLoaded === 0;
  }
  // Enable/disable unmarkAllBtn and clearDataBtn based on whether there are records
  if (unmarkAllBtn) {
    unmarkAllBtn.disabled = totalRecordsLoaded === 0;
  }
  if (clearDataBtn) {
    clearDataBtn.disabled = totalRecordsLoaded === 0;
  }
}

function clearRecordDisplay() {
    if (recordCountSpan) recordCountSpan.textContent = "Records: 0";
    if (currentRecordInfoSpan) currentRecordInfoSpan.textContent = "Current: N/A";
    if (appDetailSpan) appDetailSpan.textContent = "-";
    if (accDetailSpan) accDetailSpan.textContent = "-";
    if (tranDetailSpan) tranDetailSpan.textContent = "-";
    if (descDetailSpan) descDetailSpan.textContent = "-";
    if (amountDetailSpan) amountDetailSpan.textContent = "-";
    if (effDateDetailSpan) effDateDetailSpan.textContent = "-";
    if (serialDetailSpan) serialDetailSpan.textContent = "-";
    if (branchDetailSpan) branchDetailSpan.textContent = "-"; // Clear GL fields
    if (centerDetailSpan) centerDetailSpan.textContent = "-"; // Clear GL fields
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '-';
  // Convert to number and format with 2 decimal places and thousands separator
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return '-';
  return numAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function updateRecordDisplay() {
  if (totalRecordsLoaded > 0 && currentRecordIndex >= 0 && currentRecordIndex < totalRecordsLoaded) {
    const record = allExcelRecords[currentRecordIndex];
    if (recordCountSpan) recordCountSpan.textContent = `Records: ${totalRecordsLoaded}`;
    if (currentRecordInfoSpan) currentRecordInfoSpan.textContent = `Current: ${currentRecordIndex + 1} of ${totalRecordsLoaded}`;
    
    if (appDetailSpan) appDetailSpan.textContent = record.Application || "-";
    if (accDetailSpan) accDetailSpan.textContent = record.Account || "-";
    if (tranDetailSpan) tranDetailSpan.textContent = record.TranCode || "-";
    if (descDetailSpan) descDetailSpan.textContent = record.Description || "-";
    if (amountDetailSpan) amountDetailSpan.textContent = formatAmount(record.Amount);
    if (effDateDetailSpan) effDateDetailSpan.textContent = record.EffectiveDate || "-";
    if (serialDetailSpan) serialDetailSpan.textContent = record.SerialNumber || "-";
    // Display GL fields if present in the record
    if (branchDetailSpan) branchDetailSpan.textContent = record.Branch || "-";
    if (centerDetailSpan) centerDetailSpan.textContent = record.Center || "-";

    // Update toggleCompleteBtn text
    if (toggleCompleteBtn) {
      toggleCompleteBtn.textContent = record.completed ? "Mark as Incomplete" : "Mark as Complete";
    }
  } else {
    clearRecordDisplay();
    if (totalRecordsLoaded > 0) { // Data loaded, but index is bad (should not happen with current logic)
         if (currentRecordInfoSpan) currentRecordInfoSpan.textContent = "Current: Invalid";
    } else {
        if (currentRecordInfoSpan) currentRecordInfoSpan.textContent = "Current: N/A (No data)";
    }
    // Ensure button is in a default state if no record displayed
    if (toggleCompleteBtn) {
        toggleCompleteBtn.textContent = "Mark as Complete"; // Default text
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  startButton = document.getElementById('startButton');
  pauseButton = document.getElementById('pauseButton');
  loadDataBtn = document.getElementById('loadDataBtn');
  prevRecordBtn = document.getElementById('prevRecordBtn');
  nextRecordBtn = document.getElementById('nextRecordBtn');
  firstRecordBtn = document.getElementById('firstRecordBtn');
  lastRecordBtn = document.getElementById('lastRecordBtn');
  toggleCompleteBtn = document.getElementById('toggleCompleteBtn');
  unmarkAllBtn = document.getElementById('unmarkAllBtn');
  clearDataBtn = document.getElementById('clearDataBtn');
  statusDiv = document.getElementById('status');
  connectionStatusDiv = document.getElementById('connectionStatus');
  
  recordCountSpan = document.getElementById('recordCount');
  currentRecordInfoSpan = document.getElementById('currentRecordInfo');
  appDetailSpan = document.getElementById('appDetail');
  accDetailSpan = document.getElementById('accDetail');
  tranDetailSpan = document.getElementById('tranDetail');
  descDetailSpan = document.getElementById('descDetail');
  amountDetailSpan = document.getElementById('amountDetail');
  effDateDetailSpan = document.getElementById('effDateDetail');
  serialDetailSpan = document.getElementById('serialDetail');
  branchDetailSpan = document.getElementById('branchDetail'); // Get reference
  centerDetailSpan = document.getElementById('centerDetail'); // Get reference

  connectToNativeHost();
  // Load data from storage first, then update UI
  loadDataFromStorage(function(dataLoaded) {
    updateButtonStates(); // Update buttons based on connection AND data state
    updateRecordDisplay();  // Update display with loaded data
    if (dataLoaded) {
        statusDiv.textContent = "Previously loaded data restored.";
    }
  });

  loadDataBtn.addEventListener('click', function() {
    // Attempt to connect if not already connected
    if (!port || !isConnected) {
      console.log("Load Data: Not connected or port is null. Attempting to reconnect...");
      connectToNativeHost(); // This will update 'port' and 'isConnected'
    }

    // Check connection status again before sending the message
    if (port && isConnected) {
      console.log("Load Data: Connection active or re-established. Sending message.");
      port.postMessage({ command: "select_excel_file_dialog" });
      statusDiv.textContent = "Requested host to open file dialog.";
    } else {
      // If connection failed or was not established
      updateConnectionStatusDisplay("Failed to connect to native host.", true);
      statusDiv.textContent = "Error: Cannot request file dialog, connection failed.";
      console.error("Load Data: Port not available or not connected after attempt.");
    }
  });

  // Event listener for Previous Record button
  prevRecordBtn.addEventListener('click', function() {
    if (!isConnected) return;
    if (currentRecordIndex > 0) {
      currentRecordIndex--;
      updateRecordDisplay();
      updateButtonStates(); // Update button states after navigation
      saveDataToStorage(); // Persist the new index
    }
  });

  // Event listener for Next Record button
  nextRecordBtn.addEventListener('click', function() {
    if (!isConnected) return;
    if (currentRecordIndex < totalRecordsLoaded - 1) {
      currentRecordIndex++;
      updateRecordDisplay();
      updateButtonStates(); // Update button states after navigation
      saveDataToStorage(); // Persist the new index
    }
  });

  // Event listener for First Record button
  firstRecordBtn.addEventListener('click', function() {
    if (!isConnected) return;
    if (totalRecordsLoaded > 0) {
      currentRecordIndex = 0;
      updateRecordDisplay();
      updateButtonStates();
      saveDataToStorage();
    }
  });

  // Event listener for Last Record button
  lastRecordBtn.addEventListener('click', function() {
    if (!isConnected) return;
    if (totalRecordsLoaded > 0) {
      currentRecordIndex = totalRecordsLoaded - 1;
      updateRecordDisplay();
      updateButtonStates();
      saveDataToStorage();
    }
  });

  // Event listener for Toggle Complete button
  if (toggleCompleteBtn) {
    toggleCompleteBtn.addEventListener('click', function() {
      if (!isConnected || currentRecordIndex < 0 || currentRecordIndex >= totalRecordsLoaded) return;

      const record = allExcelRecords[currentRecordIndex];
      record.completed = !record.completed; // Toggle the status
      saveDataToStorage(); // Save the new state
      updateRecordDisplay(); // Update the button text and any other UI
      updateButtonStates(); // Ensure button enable/disable state is correct
      statusDiv.textContent = `Record ${currentRecordIndex + 1} marked as ${record.completed ? 'Complete' : 'Incomplete'}.`;
    });
  }

  // Event listener for Unmark All Records button
  if (unmarkAllBtn) {
    unmarkAllBtn.addEventListener('click', function() {
      if (totalRecordsLoaded > 0) {
        allExcelRecords.forEach(record => {
          record.completed = false;
        });
        currentRecordIndex = 0; // Reset to first record
        saveDataToStorage();
        updateRecordDisplay();
        updateButtonStates();
        statusDiv.textContent = `All ${totalRecordsLoaded} records have been marked as incomplete.`;
      }
    });
  }

  // Event listener for Clear Data button
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      if (totalRecordsLoaded > 0) {
        allExcelRecords = [];
        totalRecordsLoaded = 0;
        currentRecordIndex = -1;
        saveDataToStorage();
        updateRecordDisplay();
        updateButtonStates();
        statusDiv.textContent = "All data has been cleared.";
      }
    });
  }

  startButton.addEventListener('click', function() {
    if (!isConnected || !port) {
      updateConnectionStatusDisplay("Not connected to native host.", true);
      console.error("Not connected to native host.");
      statusDiv.textContent = "Error: Not connected to native host.";
      return;
    }

    // If already processing, don't start again
    if (isProcessing) {
      statusDiv.textContent = "Already processing records.";
      return;
    }

    isProcessing = true;
    isPaused = false;
    pauseButton.textContent = "Pause";
    pauseButton.disabled = false;

    // Find the first non-completed record starting from current position
    let nextIncompleteIndex = -1;
    for (let i = currentRecordIndex; i < totalRecordsLoaded; i++) {
      if (!allExcelRecords[i].completed) {
        nextIncompleteIndex = i;
        break;
      }
    }

    // If no incomplete records found from current position, start from beginning
    if (nextIncompleteIndex === -1) {
      for (let i = 0; i < currentRecordIndex; i++) {
        if (!allExcelRecords[i].completed) {
          nextIncompleteIndex = i;
          break;
        }
      }
    }

    // If still no incomplete records found, show message and return
    if (nextIncompleteIndex === -1) {
      statusDiv.textContent = "No incomplete records found in the dataset.";
      isProcessing = false;
      pauseButton.disabled = true;
      return;
    }

    // Update current record index to the found incomplete record
    currentRecordIndex = nextIncompleteIndex;
    updateRecordDisplay();
    updateButtonStates();
    saveDataToStorage();

    // Function to process the next record
    function processNextRecord() {
      if (!isProcessing) {
        return;
      }

      if (isPaused) {
        // If paused, check again after a delay
        setTimeout(processNextRecord, 500);
        return;
      }

      if (currentRecordIndex === -1 || currentRecordIndex >= totalRecordsLoaded) {
        statusDiv.textContent = "Batch processing completed.";
        isProcessing = false;
        pauseButton.disabled = true;
        pauseButton.textContent = "Pause";
        return;
      }

      const recordToProcess = {...allExcelRecords[currentRecordIndex]};
      if (recordToProcess.completed) {
        // Skip to next record if current one is completed
        currentRecordIndex++;
        processNextRecord();
        return;
      }

      // Format amount before sending to content script
      if (recordToProcess.Amount !== null && recordToProcess.Amount !== undefined) {
        recordToProcess.Amount = formatAmount(recordToProcess.Amount);
      }

      console.log("Sending record to content script:", recordToProcess);
      statusDiv.textContent = `Processing record ${currentRecordIndex + 1} of ${totalRecordsLoaded}...`;

      sendMessageToContentScript({ action: "start", data: recordToProcess }, function(response) {
        if (!isProcessing) {
          return;
        }

        if (chrome.runtime.lastError) {
          console.error("Error receiving response from content script:", chrome.runtime.lastError.message);
          statusDiv.textContent = `Error communicating with page: ${chrome.runtime.lastError.message}`;
          isProcessing = false;
          pauseButton.disabled = true;
          pauseButton.textContent = "Pause";
          return;
        }

        console.log("Received response from content script:", response);
        if (response && response.status) {
          const details = response.details;
          if (response.status === "success") {
            allExcelRecords[currentRecordIndex].completed = true;
            saveDataToStorage();
            updateRecordDisplay();
            updateButtonStates();

            statusDiv.textContent = `Record ${currentRecordIndex + 1} processed successfully. Checked: ${details.fieldsChecked}, Matched: ${details.fieldsMatched}.`;
            if(details.skippedFieldsLog && details.skippedFieldsLog.length > 0) {
              statusDiv.textContent += ` (Skipped ${details.skippedFieldsLog.length} fields.)`;
            }
            if (details.addAnotherButtonInfo) {
              if (details.addAnotherButtonInfo.statusMessage && details.addAnotherButtonInfo.statusMessage !== "Clicked") {
                statusDiv.textContent += ` (Add Another: ${details.addAnotherButtonInfo.statusMessage})`;
              }
            }

            // Move to next record and continue processing
            currentRecordIndex++;
            setTimeout(processNextRecord, 1000); // Add a small delay between records
          } else if (response.status === "verification_failed") {
            let errorMsg = `Record ${currentRecordIndex + 1} filled, but verification FAILED. `;
            errorMsg += `Checked: ${details.fieldsChecked}, Matched: ${details.fieldsMatched}.`;
            if (details.mismatchedFields && details.mismatchedFields.length > 0) {
              errorMsg += " Mismatches: " + details.mismatchedFields.map(f => `${f.field} (expected '${f.expected}', got '${f.actual}')`).join(", ");
            }
            if (details.notFoundFields && details.notFoundFields.length > 0) {
              errorMsg += " Fields not found during verification: " + details.notFoundFields.join(", ");
            }
            if(details.skippedFieldsLog && details.skippedFieldsLog.length > 0) {
              errorMsg += ` (Skipped/problem fields: ${details.skippedFieldsLog.length})`;
            }
            statusDiv.textContent = errorMsg;
            console.warn("Verification failed details:", details);
            isProcessing = false;
            pauseButton.disabled = true;
            pauseButton.textContent = "Pause";
          } else if (response.status === "verification_error") {
            statusDiv.textContent = `Verification error for record ${currentRecordIndex + 1}: ${response.message}`;
            console.error("Verification error details:", details);
            isProcessing = false;
            pauseButton.disabled = true;
            pauseButton.textContent = "Pause";
          } else if (response.status === "error") {
            statusDiv.textContent = `Error from content script: ${response.message}`;
            console.error("Content script error:", response);
            isProcessing = false;
            pauseButton.disabled = true;
            pauseButton.textContent = "Pause";
          } else {
            statusDiv.textContent = `Content script response for record ${currentRecordIndex + 1}: ${response.status}`;
            isProcessing = false;
            pauseButton.disabled = true;
            pauseButton.textContent = "Pause";
          }
        } else {
          statusDiv.textContent = "Received no specific status from content script.";
          console.warn("Received undefined or no status in response from content script:", response);
          isProcessing = false;
          pauseButton.disabled = true;
          pauseButton.textContent = "Pause";
        }
      });
    }

    // Start processing the first record
    processNextRecord();
  });

  pauseButton.addEventListener('click', function() {
    if (!isProcessing) {
      return;
    }

    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "Resume" : "Pause";
    statusDiv.textContent = isPaused ? "Processing paused." : "Processing resumed.";
  });

  function connectToNativeHost() {
    if (port) {
      console.log("Already connected or attempting to connect.");
      return;
    }
    console.log(`Attempting to connect to native host: ${NATIVE_HOST_NAME}`);
    updateConnectionStatusDisplay("Connecting...", false);
    
    try {
        port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
        isConnected = true;
        updateConnectionStatusDisplay("Connected. Waiting for host activity...", false);
        console.log("Port object created. Assumed connected.", port);
        updateButtonStates();

        // --- BEGIN NATIVE MESSAGE HANDLER MAP ---
        const nativeMessageHandlers = {
          "file_selected": (message) => {
            statusDiv.textContent = `Host selected file: ${message.filePath.split(/[\\/]/).pop()}. Processing...`;
            console.log(`File selected by host (and now processing): ${message.filePath}`);
            allExcelRecords = [];
            totalRecordsLoaded = 0;
            currentRecordIndex = -1;
            updateRecordDisplay();
            // The native host now directly processes after selection, no need to send "process_excel_file" from here.
          },
          "excel_data_processed": (message) => {
            if (message.excelData) {
              allExcelRecords = message.excelData.map(record => ({ ...record, completed: false })); // Initialize completed status
              totalRecordsLoaded = allExcelRecords.length;
              currentRecordIndex = totalRecordsLoaded > 0 ? 0 : -1;
              statusDiv.textContent = `Successfully processed ${totalRecordsLoaded} records.`;
              console.log("Processed Excel Data:", allExcelRecords);
            } else {
              allExcelRecords = [];
              totalRecordsLoaded = 0;
              currentRecordIndex = -1;
              statusDiv.textContent = "Excel processed, but no data in response. Message: " + (message.message || 'Unknown reason');
              console.warn("Excel data processed, but no excelData field in response.", message);
            }
            updateRecordDisplay();
            saveDataToStorage();
          },
          "excel_processing_error": (message) => {
            console.error("Error processing Excel file from host:", message.message);
            statusDiv.textContent = `Error: ${message.message}`;
            allExcelRecords = []; // Clear data on processing error
            totalRecordsLoaded = 0;
            currentRecordIndex = -1;
            updateRecordDisplay();
            saveDataToStorage(); // Persist the cleared state
          },
          "file_selection_cancelled": (message) => {
            statusDiv.textContent = "File selection cancelled by host.";
          },
          "success": (message) => { // Generic success from host for other commands
            if (message.received_command) {
                statusDiv.textContent = `Host: ${message.message || ('Command ' + message.received_command + ' successful')}`;
            }
          },
          "error": (message) => { // Generic error from host
            console.error("Error from native host:", message.error);
            statusDiv.textContent = `Error from host: ${message.error || 'Unknown error'}`;
          },
          "default": (message) => {
            console.warn("Received unhandled message format from native host:", message);
            statusDiv.textContent = message.message || "Received unhandled or status-less message from host.";
          }
        };
        // --- END NATIVE MESSAGE HANDLER MAP ---

        port.onMessage.addListener(function(message) {
          console.log("Received message from native host:", message);
          updateConnectionStatusDisplay("Host active.", false); 

          const handler = nativeMessageHandlers[message.status] || nativeMessageHandlers["default"];
          try {
            handler(message);
          } catch (e) {
            console.error("Error in native message handler:", e, "Original message:", message);
            statusDiv.textContent = "Client-side error handling native message.";
          }
        });

        port.onDisconnect.addListener(function() {
          isConnected = false;
          let errorMsg = "Disconnected from native host.";
          if (chrome.runtime.lastError) {
            console.error("Disconnect reason:", chrome.runtime.lastError.message);
            errorMsg = `Disconnected: ${chrome.runtime.lastError.message}`;
          }
          port = null;
          updateConnectionStatusDisplay(errorMsg, true);
          updateButtonStates();
          console.log("Native host disconnected. Data preserved.");
        });

    } catch (err) {
        console.error("Failed to connect to native host:", err);
        isConnected = false;
        updateConnectionStatusDisplay(`Connection failed: ${err.message || 'Unknown error'}`, true);
        updateButtonStates();
        port = null;
        updateRecordDisplay();
    }
  }

  // Function to send messages to content script
  function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script or receiving response:', chrome.runtime.lastError.message);
            if (callback) callback({ status: "error", message: chrome.runtime.lastError.message});
          } else {
            if (callback) callback(response);
          }
        });
      } else {
        console.error("Could not find active tab to send message to.");
        if (callback) callback({ status: "error", message: "Could not find active tab."}) ;
      }
    });
  }

  // Add a listener for when the popup is closing to ensure data is saved
  window.addEventListener('unload', function() {
    if (isConnected) {
      console.log("Popup unloading, ensuring data is saved if necessary.");
    }
  });
});
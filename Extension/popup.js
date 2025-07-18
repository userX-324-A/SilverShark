// JavaScript for popup.html

const NATIVE_HOST_NAME = "com.microbytes.silvershark";
let port = null;
let isConnected = false;
let isTargetPage = false;

let allExcelRecords = [];
let currentRecordIndex = -1;
let totalRecordsLoaded = 0;

let isPaused = false;
let isProcessing = false;

let startButton, pauseButton, loadDataBtn;
let prevRecordBtn, nextRecordBtn, firstRecordBtn, lastRecordBtn;
let connectionStatusDiv, statusDiv;
let recordCountSpan, currentRecordInfoSpan;
let appDetailSpan, accDetailSpan, tranDetailSpan, descDetailSpan, amountDetailSpan, effDateDetailSpan, serialDetailSpan;
let branchDetailSpan, centerDetailSpan;
let toggleCompleteBtn;
let unmarkAllBtn, clearDataBtn;

const STORAGE_KEY = "excelExtensionData";

function saveDataToStorage() {
    const dataToSave = { allExcelRecords, currentRecordIndex, totalRecordsLoaded };
    chrome.storage.local.set({ [STORAGE_KEY]: dataToSave }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving data:", chrome.runtime.lastError);
        }
    });
}

function loadDataFromStorage(callback) {
    chrome.storage.local.get([STORAGE_KEY], result => {
        if (chrome.runtime.lastError) {
            console.error("Error loading data:", chrome.runtime.lastError);
            if (callback) callback(false);
            return;
        }
        if (result[STORAGE_KEY]) {
            const loaded = result[STORAGE_KEY];
            allExcelRecords = (loaded.allExcelRecords || []).map(r => ({ ...r, completed: r.completed || false }));
            currentRecordIndex = loaded.currentRecordIndex ?? -1;
            totalRecordsLoaded = loaded.totalRecordsLoaded ?? 0;
            if (callback) callback(true);
        } else {
            if (callback) callback(false);
        }
    });
}

function updateConnectionStatusDisplay() {
    if (!connectionStatusDiv) return;

    if (!isConnected) {
        connectionStatusDiv.textContent = "Disconnected from companion app.";
        connectionStatusDiv.style.color = "red";
    } else {
        if (isTargetPage) {
            connectionStatusDiv.textContent = "Connected | Target page is active.";
            connectionStatusDiv.style.color = "green";
        } else {
            connectionStatusDiv.textContent = "Connected | Target page not found.";
            connectionStatusDiv.style.color = "orange";
        }
    }
}

function updateButtonStates() {
    if (!loadDataBtn) return; // UI not ready
    const hasData = totalRecordsLoaded > 0;
    const isFirst = currentRecordIndex <= 0;
    const isLast = currentRecordIndex >= totalRecordsLoaded - 1;

    loadDataBtn.disabled = !isConnected;
    startButton.disabled = !isConnected || !hasData || isProcessing || !isTargetPage;
    pauseButton.disabled = !isProcessing;
    
    prevRecordBtn.disabled = !hasData || isFirst || isProcessing;
    nextRecordBtn.disabled = !hasData || isLast || isProcessing;
    firstRecordBtn.disabled = !hasData || isFirst || isProcessing;
    lastRecordBtn.disabled = !hasData || isLast || isProcessing;

    toggleCompleteBtn.disabled = !hasData || currentRecordIndex === -1 || isProcessing;
    unmarkAllBtn.disabled = !hasData || isProcessing;
    clearDataBtn.disabled = !hasData || isProcessing;
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
    if (branchDetailSpan) branchDetailSpan.textContent = "-";
    if (centerDetailSpan) centerDetailSpan.textContent = "-";
    if (toggleCompleteBtn) toggleCompleteBtn.textContent = "Mark as Complete";
}

function formatAmount(amount) {
    if (amount === null || amount === undefined || amount === '') return '-';
    const numAmount = parseFloat(String(amount).replace(/,/g, ''));
    if (isNaN(numAmount)) return String(amount);
    return numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateRecordDisplay() {
    if (totalRecordsLoaded > 0 && currentRecordIndex >= 0 && currentRecordIndex < totalRecordsLoaded) {
        const record = allExcelRecords[currentRecordIndex];
        recordCountSpan.textContent = `Records: ${totalRecordsLoaded}`;
        currentRecordInfoSpan.textContent = `Current: ${currentRecordIndex + 1} of ${totalRecordsLoaded}`;
        
        appDetailSpan.textContent = record.Application || "-";
        accDetailSpan.textContent = record.Account || "-";
        tranDetailSpan.textContent = record.TranCode || "-";
        descDetailSpan.textContent = record.Description || "-";
        amountDetailSpan.textContent = formatAmount(record.Amount);
        effDateDetailSpan.textContent = record.EffectiveDate || "-";
        serialDetailSpan.textContent = record.SerialNumber || "-";
        branchDetailSpan.textContent = record.Branch || "-";
        centerDetailSpan.textContent = record.Center || "-";
        
        toggleCompleteBtn.textContent = record.completed ? "Mark as Incomplete" : "Mark as Complete";
        
        const recordRow = document.getElementById(`record-row-${currentRecordIndex}`);
        if(recordRow) {
            document.querySelectorAll('.record-item.active').forEach(el => el.classList.remove('active'));
            recordRow.classList.add('active');
        }

    } else {
        clearRecordDisplay();
    }
}

function initializeUI() {
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
    branchDetailSpan = document.getElementById('branchDetail');
    centerDetailSpan = document.getElementById('centerDetail');
}

function bindEventListeners() {
    const rebind = (elementId, event, handler) => {
        const oldElement = document.getElementById(elementId);
        if (oldElement) {
            const newElement = oldElement.cloneNode(true);
            oldElement.parentNode.replaceChild(newElement, oldElement);
            newElement.addEventListener(event, handler);
            return newElement;
        }
        return null;
    };

    loadDataBtn = rebind('loadDataBtn', 'click', () => {
        if (!isConnected) connectToNativeHost();
        if (isConnected) {
            port.postMessage({ command: "select_excel_file_dialog" });
            statusDiv.textContent = "Requesting file dialog...";
        }
    });

    const navigate = (newIndex) => {
        if (isProcessing) return;
        currentRecordIndex = newIndex;
        saveDataToStorage();
        updateRecordDisplay();
        updateButtonStates();
    };

    prevRecordBtn = rebind('prevRecordBtn', 'click', () => navigate(currentRecordIndex - 1));
    nextRecordBtn = rebind('nextRecordBtn', 'click', () => navigate(currentRecordIndex + 1));
    firstRecordBtn = rebind('firstRecordBtn', 'click', () => navigate(0));
    lastRecordBtn = rebind('lastRecordBtn', 'click', () => navigate(totalRecordsLoaded - 1));

    toggleCompleteBtn = rebind('toggleCompleteBtn', 'click', () => {
        if (currentRecordIndex > -1 && !isProcessing) {
            const record = allExcelRecords[currentRecordIndex];
            record.completed = !record.completed;
            statusDiv.textContent = `Record ${currentRecordIndex + 1} marked as ${record.completed ? 'Complete' : 'Incomplete'}.`;
            navigate(currentRecordIndex);
        }
    });

    unmarkAllBtn = rebind('unmarkAllBtn', 'click', () => {
        if (!isProcessing) {
            allExcelRecords.forEach(r => r.completed = false);
            statusDiv.textContent = "All records marked as incomplete.";
            navigate(0);
        }
    });

    clearDataBtn = rebind('clearDataBtn', 'click', () => {
        // The confirm() dialog is blocking and can cause issues.
        // For now, it is removed. A custom UI modal would be a better UX.
        if (!isProcessing) {
            allExcelRecords = [];
            totalRecordsLoaded = 0;
            statusDiv.textContent = "All data cleared.";
            navigate(-1);
        }
    });

    startButton = rebind('startButton', 'click', () => {
        if (isProcessing) return;
        isProcessing = true;
        isPaused = false;
        pauseButton.textContent = "Pause";
        statusDiv.textContent = "Starting batch process...";
        updateButtonStates();
        processNextRecord();
    });

    pauseButton = rebind('pauseButton', 'click', () => {
        if (!isProcessing) return;
        isPaused = !isPaused;
        pauseButton.textContent = isPaused ? "Resume" : "Pause";
        statusDiv.textContent = isPaused ? "Processing paused." : "Processing resumed.";
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    bindEventListeners();
    connectToNativeHost();
    loadDataFromStorage(loaded => {
        if (loaded) statusDiv.textContent = "Restored previous session.";
        updateRecordDisplay();
        updateButtonStates();
    });
});

function processNextRecord() {
    if (!isProcessing) return;
    if (isPaused) {
        setTimeout(processNextRecord, 500);
        return;
    }

    const searchIndex = currentRecordIndex > -1 ? currentRecordIndex : 0;
    const nextIndex = allExcelRecords.findIndex((r, i) => !r.completed && i >= searchIndex);

    if (nextIndex === -1) {
        statusDiv.textContent = "Batch processing complete. All records processed.";
        isProcessing = false;
        isPaused = false;
        updateRecordDisplay();
        updateButtonStates();
        return;
    }

    currentRecordIndex = nextIndex;
    updateRecordDisplay();
    
    const recordToProcess = allExcelRecords[currentRecordIndex];
    statusDiv.textContent = `Processing record ${currentRecordIndex + 1}...`;

    sendMessageToContentScript({ action: "start", data: recordToProcess }, response => {
        if (!isProcessing) return;

        if (chrome.runtime.lastError || !response) {
            statusDiv.textContent = `Error on record ${currentRecordIndex + 1}: ${chrome.runtime.lastError?.message || "No response."}`;
            isProcessing = false;
        } else if (response.status === "success") {
            const processedRecordIndex = currentRecordIndex;
            allExcelRecords[processedRecordIndex].completed = true;
            statusDiv.textContent = `Record ${processedRecordIndex + 1} completed.`;
            saveDataToStorage();
            updateRecordDisplay();
            setTimeout(processNextRecord, 1000);
        } else {
            statusDiv.textContent = `Failed on record ${currentRecordIndex + 1}: ${response.message || 'Unknown verification error.'}`;
            isProcessing = false;
        }
        updateButtonStates();
    });
}

function connectToNativeHost() {
    if (port) return;
    
    try {
        port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
        isConnected = true;

        // After connecting, immediately check if we are on the right page
        sendMessageToContentScript({ action: "check_page" }, response => {
            if (response && response.status === "page_found") {
                isTargetPage = true;
            } else {
                isTargetPage = false;
            }
            updateConnectionStatusDisplay();
            updateButtonStates();
        });

        port.onMessage.addListener(msg => {
            if (msg.status === "processed_excel_data") {
                allExcelRecords = msg.data.map(r => ({ ...r, completed: false }));
                totalRecordsLoaded = allExcelRecords.length;
                currentRecordIndex = totalRecordsLoaded > 0 ? 0 : -1;
                
                saveDataToStorage();
                bindEventListeners(); // Re-bind listeners with fresh closures
                updateRecordDisplay();
                updateButtonStates();
                statusDiv.textContent = `Loaded ${totalRecordsLoaded} records.`;
            } else if (msg.status === "error") {
                statusDiv.textContent = `Host Error: ${msg.message}`;
            }
        });

        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                console.error(`Disconnected due to: ${chrome.runtime.lastError.message}`);
            }
            port = null;
            isConnected = false;
            isProcessing = false;
            isTargetPage = false;
            updateConnectionStatusDisplay("Disconnected", true);
            updateButtonStates();
        });

    } catch (err) {
        port = null;
        isConnected = false;
        isTargetPage = false;
        updateConnectionStatusDisplay("Connection Failed", true);
    }
    
    updateButtonStates();
}

function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) {
            statusDiv.textContent = "Error: No active tab found.";
            return;
        }
        chrome.tabs.sendMessage(tabs[0].id, message, response => {
            if (chrome.runtime.lastError) {
                if (callback) callback(null);
            } else {
                if (callback) callback(response);
            }
        });
    });
}
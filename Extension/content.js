// Content script for Web Interactor Extension

console.log("Content script loaded.");

// --- BEGIN CONFIGURATION ---
let CONFIG = {
  selectors: {
    application: '[data-el-id="fldAppl"]',
    account: '[data-el-id="fldAcct"]',
    tranCodeCategory: '[data-el-id="fldTranCodeCategory"]',
    tranCode: '[data-el-id="fldTranCode"]',
    description: '[data-el-id="fldTranDescription"]',
    amount: '[data-el-id="fldTranAmt"]',
    effectiveDate: '[data-el-id="29032:25"]',
    serialNumber: '[data-el-id="fldSerial"]',
    glBranch: '[data-el-id="fldGLBranch"]',
    glCenter: '[data-el-id="fldGLCenter"]',
    addAnotherButton: '[data-el-id="addanother"]',
    errorPopup: '[data-page-id="oteBatchDetailPrompt"]',
    forcePostButton: '[data-el-id="btnForcePost"]'
  },
  dynamicFields: {
    tranCodeCategory: true,
    tranCode: true
  },
  defaultValues: {
    tranCodeCategory: "00"
  },
  // Field keys that might be skipped if blank or null
  skippableBlankFields: ['effectiveDate', 'serialNumber']
};
let timeouts = {};

// Load timeouts from storage and set defaults
chrome.storage.sync.get({
  timeouts: {
    defaultElementWait: 10000,
    addAnotherButtonWait: 5000,
    formResetWait: 7000,
    formResetAfterErrorWait: 5000
  }
}, function(items) {
  timeouts = items.timeouts;
  console.log("Timeouts loaded from storage:", timeouts);
});

// Listen for changes in storage
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.timeouts) {
    timeouts = changes.timeouts.newValue;
    console.log("Timeouts updated:", timeouts);
  }
});

// --- END CONFIGURATION ---

// --- BEGIN HELPER FOR DYNAMIC FIELDS ---
async function waitForElementWithOptions(selector, valueToSelect, timeoutMs) {
  const waitTimeout = timeoutMs || timeouts.defaultElementWait;
  console.log(`Waiting for options in ${selector} or for value '${valueToSelect}'`);
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        // Check if it's a select element and has options
        if (element.tagName === 'SELECT' && element.options && element.options.length > 0) {
          // If a specific valueToSelect is provided, check if it exists
          if (valueToSelect) {
            let foundOption = false;
            for (let i = 0; i < element.options.length; i++) {
              if (element.options[i].value === valueToSelect || element.options[i].text === valueToSelect) {
                foundOption = true;
                break;
              }
            }
            if (foundOption) {
              clearInterval(interval);
              console.log(`Option '${valueToSelect}' found in ${selector}.`);
              resolve(element);
              return;
            }
          } else {
            // If no specific value, just options being present is enough
            clearInterval(interval);
            console.log(`Options found in ${selector}.`);
            resolve(element);
            return;
          }
        }
        // If not a select or no options yet, but element exists (useful for non-selects or to wait for any children)
        // For this specific function, we are opinionated towards SELECT, but you could make it more generic
        // For now, we continue polling if it's a SELECT without the desired option/any options.
      } // else element not found yet

      if (Date.now() - startTime > waitTimeout) {
        clearInterval(interval);
        console.warn(`Timeout waiting for options or value '${valueToSelect}' in ${selector}`);
        reject(new Error(`Timeout waiting for options or value '${valueToSelect}' in ${selector}`));
      }
    }, 500); // Poll every 500ms
  });
}
// --- END HELPER FOR DYNAMIC FIELDS ---

// --- BEGIN HELPER FOR ELEMENT EXISTENCE ---
async function waitForElement(selector, timeoutMs) {
  const waitTimeout = timeoutMs || timeouts.defaultElementWait;
  console.log(`Waiting for element ${selector} to exist`);
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        console.log(`Element ${selector} found.`);
        resolve(element);
      } else if (Date.now() - startTime > waitTimeout) {
        clearInterval(interval);
        console.warn(`Timeout waiting for element ${selector} to exist.`);
        reject(new Error(`Timeout waiting for element ${selector}`));
      }
    }, 500); // Poll every 500ms
  });
}
// --- END HELPER FOR ELEMENT EXISTENCE ---

let isPaused = false;
let currentDataRecord = null; // Will hold the current record to be entered

// --- BEGIN FIELDS SPECIFICATION BUILDER ---
function buildFieldsSpec(data) {
  // Base fields that are always processed
  let amountValue = data.Amount;
  if (amountValue && typeof amountValue === 'string') {
    // Remove commas from the amount string to ensure it's a raw number.
    amountValue = amountValue.replace(/,/g, '');
  }

  let baseSpec = {
    application: { selector: CONFIG.selectors.application, value: data.Application, originalKey: 'Application' },
    account: { selector: CONFIG.selectors.account, value: data.Account, originalKey: 'Account' },
    tranCodeCategory: { selector: CONFIG.selectors.tranCodeCategory, value: CONFIG.defaultValues.tranCodeCategory, originalKey: 'TranCodeCategory' },
    tranCode: { selector: CONFIG.selectors.tranCode, value: data.TranCode, originalKey: 'TranCode' },
    description: { selector: CONFIG.selectors.description, value: data.Description, originalKey: 'Description' },
    amount: { selector: CONFIG.selectors.amount, value: amountValue, originalKey: 'Amount' },
    effectiveDate: { selector: CONFIG.selectors.effectiveDate, value: data.EffectiveDate, originalKey: 'EffectiveDate' },
    serialNumber: { selector: CONFIG.selectors.serialNumber, value: data.SerialNumber, originalKey: 'SerialNumber' }
  };

  // Conditionally add GL-specific fields if Application is "GL"
  if (data.Application && String(data.Application).toUpperCase() === "GL") {
    console.log("Application is GL, adding Branch and Center fields.");
    const glFieldsSpec = {
      branch: { selector: CONFIG.selectors.glBranch, value: data.Branch, originalKey: 'Branch', isGLField: true },
      center: { selector: CONFIG.selectors.glCenter, value: data.Center, originalKey: 'Center', isGLField: true }
    };
    // Order: application, account, glFields, then the rest
    return {
      application: baseSpec.application,
      account: baseSpec.account,
      ...glFieldsSpec,
      tranCodeCategory: baseSpec.tranCodeCategory,
      tranCode: baseSpec.tranCode,
      description: baseSpec.description,
      amount: baseSpec.amount,
      effectiveDate: baseSpec.effectiveDate,
      serialNumber: baseSpec.serialNumber
    };
  }
  return baseSpec;
}
// --- END FIELDS SPECIFICATION BUILDER ---

// --- BEGIN INDIVIDUAL FIELD FILLING LOGIC ---
async function _attemptFillSingleField(fieldKey, fieldInfo) {
  // Helper function to fill a single field.
  // Returns an object: { status: 'success' | 'skipped' | 'error', field: originalKey, reason?: string }
  try {
    let inputElement;
    if (CONFIG.dynamicFields[fieldKey]) {
      console.log(`Field ${fieldKey} is dynamic, waiting for options...`);
      try {
        inputElement = await waitForElementWithOptions(fieldInfo.selector, String(fieldInfo.value));
      } catch (waitError) {
        console.warn(`Could not find options/value for dynamic field ${fieldKey} (${fieldInfo.selector}): ${waitError.message}`);
        return { status: 'skipped', field: fieldInfo.originalKey, reason: `Wait for options timed out: ${waitError.message}` };
      }
    } else if (fieldInfo.isGLField) {
      console.log(`Field ${fieldKey} is a GL field, waiting for it to exist...`);
      try {
        inputElement = await waitForElement(fieldInfo.selector);
      } catch (waitError) {
        console.warn(`Could not find GL field ${fieldKey} (${fieldInfo.selector}): ${waitError.message}`);
        return { status: 'skipped', field: fieldInfo.originalKey, reason: `Wait for GL field timed out: ${waitError.message}` };
      }
    } else {
      inputElement = document.querySelector(fieldInfo.selector);
    }

    if (inputElement) {
      if (inputElement.disabled || inputElement.readOnly) {
        console.warn(`Element for ${fieldKey} (${fieldInfo.selector}) is not modifiable.`);
        return { status: 'skipped', field: fieldInfo.originalKey, reason: "Not modifiable" };
      }
      inputElement.value = fieldInfo.value;
      console.log(`Set ${fieldKey} to: ${fieldInfo.value}`);
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      return { status: 'success', field: fieldInfo.originalKey };
    } else {
      console.warn(`Could not find element for ${fieldKey} with selector: ${fieldInfo.selector} (after initial checks).`);
      return { status: 'skipped', field: fieldInfo.originalKey, reason: "Selector not found (post-wait)" };
    }
  } catch (error) {
    console.error(`Error processing field ${fieldKey} with selector ${fieldInfo.selector}:`, error);
    return { status: 'error', field: fieldInfo.originalKey, reason: `Error: ${error.message}` };
  }
}
// --- END INDIVIDUAL FIELD FILLING LOGIC ---

// --- BEGIN CORE FIELD FILLING ORCHESTRATION ---
async function _performActualFieldFilling(fieldsSpec) {
  let skippedFields = [];
  let filledFieldsCount = 0;

  for (const fieldKey in fieldsSpec) {
    if (Object.hasOwnProperty.call(fieldsSpec, fieldKey)) {
      const fieldInfo = fieldsSpec[fieldKey];

      if (CONFIG.skippableBlankFields.includes(fieldKey) &&
          (fieldInfo.value == null || String(fieldInfo.value).trim() === '')) {
        console.log(`Skipping blank or missing field: ${fieldKey}`);
        skippedFields.push({ field: fieldInfo.originalKey, reason: "Blank or missing value" }); // More structured skip
        continue;
      }

      const fillResult = await _attemptFillSingleField(fieldKey, fieldInfo);
      if (fillResult.status === 'success') {
        filledFieldsCount++;
      } else {
        skippedFields.push({ field: fillResult.field, reason: fillResult.reason });
      }
    }
  }
  return { filledFieldsCount, skippedFields };
}
// --- END CORE FIELD FILLING ORCHESTRATION ---

// --- BEGIN FIELD VERIFICATION LOGIC ---
function _performFieldVerification(fieldsSpec, skippedFieldsDuringFill) {
  let verificationResults = {
    allMatch: true,
    mismatchedFields: [],
    notFoundFields: [],
    fieldsChecked: 0,
    fieldsMatched: 0
    // skippedFieldsLog is added by the caller if needed
  };

  for (const fieldKey in fieldsSpec) {
    if (Object.hasOwnProperty.call(fieldsSpec, fieldKey)) {
      const fieldInfo = fieldsSpec[fieldKey];
      const wasSkippedDuringFill = skippedFieldsDuringFill.some(skipped => skipped.field === fieldInfo.originalKey);

      if (wasSkippedDuringFill) {
        continue; // Don't verify fields that were skipped during the fill phase
      }
      
      verificationResults.fieldsChecked++;
      try {
        const inputElement = document.querySelector(fieldInfo.selector);
        if (inputElement) {
          const readValue = inputElement.value;
          const expectedValue = fieldInfo.value != null ? String(fieldInfo.value) : "";
          
          if (readValue !== expectedValue) {
            verificationResults.allMatch = false;
            verificationResults.mismatchedFields.push({
              field: fieldInfo.originalKey,
              expected: expectedValue,
              actual: readValue
            });
            console.warn('Mismatch for ' + fieldInfo.originalKey + ': Expected \'' + expectedValue + '\', Got \'' + readValue + '\'');
          } else {
            verificationResults.fieldsMatched++;
            console.log('Match for ' + fieldInfo.originalKey + ': \'' + expectedValue + '\'');
          }
        } else {
          verificationResults.allMatch = false;
          verificationResults.notFoundFields.push(fieldInfo.originalKey);
          console.warn('Could not find element for ' + fieldInfo.originalKey + ' during verification with selector: ' + fieldInfo.selector);
        }
      } catch (error) {
        verificationResults.allMatch = false;
        verificationResults.mismatchedFields.push({
            field: fieldInfo.originalKey,
            expected: String(fieldInfo.value), // Ensure value is stringified
            actual: 'Error during read: ' + error.message
        });
        console.error('Error verifying field ' + fieldInfo.originalKey + ':', error);
      }
    }
  }
  return verificationResults;
}
// --- END FIELD VERIFICATION LOGIC ---

// --- BEGIN 'ADD ANOTHER' BUTTON LOGIC ---
async function _handleAddAnotherButtonClick() {
  let addAnotherStatus = {
    clicked: false,
    fieldsWereReset: false,
    statusMessage: '',
    error: null
  };
  console.log("Attempting to click 'add another' button and wait for form reset.");

  try {
    const addButton = await waitForElement(CONFIG.selectors.addAnotherButton, timeouts.addAnotherButtonWait);
    if (addButton.disabled) {
      console.warn("The 'add another' button is disabled.");
      addAnotherStatus.statusMessage = "Add Another button disabled.";
      return addAnotherStatus;
    }

    addButton.click();
    console.log("'Add another' button clicked successfully.");
    addAnotherStatus.clicked = true;

    // --- Helper function to wait for field reset ---
    async function waitForFormReset(timeout, initialMessagePrefix) {
      return new Promise((resolve) => {
        const startTime = Date.now();
        const appFieldSelector = CONFIG.selectors.application;
        let resetStatus = { success: false, message: "" };

        const checkField = () => {
          const appField = document.querySelector(appFieldSelector);
          if (appField && appField.value === "") {
            console.log(`${initialMessagePrefix}Application field has been reset.`);
            resetStatus = { success: true, message: `${initialMessagePrefix}Fields reset.` };
            resolve(resetStatus);
            return;
          }
          if (Date.now() - startTime > timeout) {
            console.warn(`${initialMessagePrefix}Timeout waiting for application field to reset.`);
            resetStatus = { success: false, message: `${initialMessagePrefix}Fields did NOT reset within timeout.` };
            resolve(resetStatus);
            return;
          }
          setTimeout(checkField, 500);
        };
        checkField();
      });
    }
    // --- End Helper ---

    // Initial wait for form reset
    let resetAttempt = await waitForFormReset(timeouts.formResetWait, "Clicked. ");
    addAnotherStatus.fieldsWereReset = resetAttempt.success;
    addAnotherStatus.statusMessage = resetAttempt.message;

    // If fields did not reset, check for error popup and attempt force post
    if (!addAnotherStatus.fieldsWereReset) {
      console.log("Fields did not reset initially. Checking for error popup:", CONFIG.selectors.errorPopup);
      const errorPopupElement = document.querySelector(CONFIG.selectors.errorPopup);

      if (errorPopupElement && errorPopupElement.offsetParent !== null) { // Check if visible
        console.log("Error popup detected. Attempting to click force post button:", CONFIG.selectors.forcePostButton);
        addAnotherStatus.statusMessage = "Clicked. Fields not reset. Error popup detected. ";
        
        try {
          const forceButton = await waitForElement(CONFIG.selectors.forcePostButton, 2000); // Shorter wait for the button itself
          if (forceButton && !forceButton.disabled) {
            forceButton.click();
            console.log("Force post button clicked.");
            addAnotherStatus.statusMessage += "Force post clicked. ";
            // Wait for reset again after clicking force post
            resetAttempt = await waitForFormReset(timeouts.formResetAfterErrorWait, "After force post: ");
            addAnotherStatus.fieldsWereReset = resetAttempt.success;
            addAnotherStatus.statusMessage += resetAttempt.message;
          } else if (forceButton && forceButton.disabled) {
            console.warn("Force post button found but is disabled.");
            addAnotherStatus.statusMessage += "Force post button disabled. Fields not reset.";
          } else {
            // waitForElement would throw if not found within its timeout
            // This path might not be hit if waitForElement rejects as expected
            console.warn("Force post button not found within error popup (unexpected).");
            addAnotherStatus.statusMessage += "Force post button not found. Fields not reset.";
          }
        } catch (forcePostError) {
          console.error("Error clicking force post button or waiting for it:", forcePostError);
          addAnotherStatus.statusMessage += `Error during force post: ${forcePostError.message}. Fields not reset.`;
          addAnotherStatus.error = addAnotherStatus.error ? `${addAnotherStatus.error}; ${forcePostError.message}` : forcePostError.message;
        }
      } else {
        console.log("Error popup not detected or not visible after initial reset timeout.");
        // statusMessage already reflects the initial timeout
      }
    }
    return addAnotherStatus;

  } catch (error) {
    console.error("Error interacting with the 'add another' button or waiting for reset:", error);
    addAnotherStatus.statusMessage = addAnotherStatus.statusMessage || `Error during 'Add Another' or reset wait: ${error.message}`;
    addAnotherStatus.error = error.message;
    return addAnotherStatus;
  }
}
// --- END 'ADD ANOTHER' BUTTON LOGIC ---

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);

  if (message.action === "start") {
    if (message.data) {
      currentDataRecord = message.data;
      // Pass sendResponse to fillFormFields so it can reply
      fillFormFields(currentDataRecord, sendResponse); 
    } else {
      // This case might not need a response or a different kind of response
      currentDataRecord = {
        application: "TestApp",
        account: "12345",
        tranCode: "TC001",
        description: "Test transaction",
        amount: "100.00",
        effectiveDate: "2023-10-27",
        serialNumber: "SNX987"
      };
      fillFormFields(currentDataRecord, null); // Or a default response
      sendResponse({ status: "simulated_fill_no_verification" }); // Example immediate response
    }
  } else if (message.action === "pause") {
    pauseDataEntry();
    sendResponse({ status: "paused" });
  }
  // Return true to indicate you wish to send a response asynchronously.
  // This is important if fillFormFields will be sending the response.
  return true; 
});

function startDataEntry(dataRecord) {
  // startDataEntry no longer calls fillFormFields directly, 
  // it's called from the message listener to handle sendResponse.
  console.log("Preparing for data entry with record:", dataRecord);
  isPaused = false;
  // TODO: Implement logic to get the next record if part of a dataset
}

function pauseDataEntry() {
  console.log("Pausing data entry...");
  isPaused = true;
  // TODO: Store current state if needed
}

// Make fillFormFields async to use await for waitForElementWithOptions
async function fillFormFields(data, sendResponse) {
  if (isPaused) {
    console.log("Data entry is paused. Not filling fields.");
    if (sendResponse) sendResponse({ status: "error", message: "Data entry is paused." });
    return;
  }
  console.log("Attempting to fill form fields with data:", data);

  const fieldsSpec = buildFieldsSpec(data);

  // 1. Attempt to fill fields
  const { filledFieldsCount, skippedFields } = await _performActualFieldFilling(fieldsSpec);
  console.log("Finished attempting to fill form fields.", { filledFieldsCount, skippedFields });

  // 2. Perform verification
  let verificationResults = _performFieldVerification(fieldsSpec, skippedFields);
  verificationResults.skippedFieldsLog = skippedFields; // Add skipped fields log to the final verification result

  // Early exit if critical filling errors occurred (no fields filled due to major issues)
  if (filledFieldsCount === 0 && skippedFields.some(sf => sf.reason && (sf.reason.includes('timed out') || sf.reason.includes('Selector not found')))) {
    verificationResults.allMatch = false; 
    console.warn("No fields were actively filled to verify due to timeouts or selectors not found.");
    if (sendResponse) {
        sendResponse({ 
            status: "verification_error", 
            message: "No fields could be filled or found for verification.", 
            details: verificationResults 
        });
    }
    return;
  }
  
  // 3. Handle "Add Another" button click ONLY if verification was successful (or all skippable)
  let addAnotherResult = null;
  if (verificationResults.allMatch) { // True if all verifiable fields matched, or if all fields were successfully skipped.
    if (filledFieldsCount > 0 || (filledFieldsCount === 0 && skippedFields.length === Object.keys(fieldsSpec).length)) {
      // Proceed if fields were filled and matched, OR if all fields were skippable and correctly skipped.
      console.log("Verification successful or all fields skippable, proceeding to 'Add Another'.");
      addAnotherResult = await _handleAddAnotherButtonClick();
      verificationResults.addAnotherButtonInfo = addAnotherResult; // Store the full result

      // If "Add Another" process failed to reset fields, this is now a critical failure for the record.
      if (!addAnotherResult || !addAnotherResult.fieldsWereReset) {
        console.warn("'Add Another' process did not complete successfully or fields did not reset.");
        if (sendResponse) {
            sendResponse({
                status: "verification_failed", // Or a more specific status like "add_another_failed_reset"
                message: addAnotherResult ? addAnotherResult.statusMessage : "Add Another button action failed to confirm reset.",
                details: verificationResults
            });
        }
        return;
      }
    } else {
      // This case (allMatch true, but filledFieldsCount is 0 and not all fields were skippable)
      // should ideally be caught by the "No fields were actively filled" check above or means verification logic might need refinement.
      // For safety, treat as if verification didn't pass sufficiently to click "Add Another".
      console.log("Verification nominally matched, but no fields were actively filled and not all were skippable. Skipping 'Add Another'.");
    }
  }


  // 4. Send final response
  if (sendResponse) {
    const finalStatus = verificationResults.allMatch && verificationResults.addAnotherButtonInfo && verificationResults.addAnotherButtonInfo.fieldsWereReset 
                        ? "success" 
                        : "verification_failed";
    
    let message = finalStatus === "success" ? "Record processed and form reset." : "Verification failed or form not reset.";
    if (verificationResults.addAnotherButtonInfo && verificationResults.addAnotherButtonInfo.statusMessage && finalStatus !== "success") {
        message = verificationResults.addAnotherButtonInfo.statusMessage; // Use more specific message from addAnother logic
    } else if (!verificationResults.allMatch) {
        message = "Field verification failed.";
    }


    console.log(`Sending final response to popup. Status: ${finalStatus}, Details:`, verificationResults);
    sendResponse({ 
        status: finalStatus,
        message: message, // Provide a consolidated message
        details: verificationResults 
    });
  } else {
    console.log("No sendResponse callback provided. Verification results:", verificationResults);
  }
}

// Future functions for reading data, filling forms, and clicking buttons will go here.

// ... existing code ...
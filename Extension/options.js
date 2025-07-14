// Saves options to chrome.storage
function save_options() {
  const defaultElementWait = document.getElementById('defaultElementWait').value;
  const addAnotherButtonWait = document.getElementById('addAnotherButtonWait').value;
  const formResetWait = document.getElementById('formResetWait').value;
  const formResetAfterErrorWait = document.getElementById('formResetAfterErrorWait').value;

  const timeouts = {
    defaultElementWait: parseInt(defaultElementWait, 10) || 10000,
    addAnotherButtonWait: parseInt(addAnotherButtonWait, 10) || 5000,
    formResetWait: parseInt(formResetWait, 10) || 7000,
    formResetAfterErrorWait: parseInt(formResetAfterErrorWait, 10) || 5000
  };

  chrome.storage.sync.set({
    timeouts: timeouts
  }, function() {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1500);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default values from content.js CONFIG
  chrome.storage.sync.get({
    timeouts: {
      defaultElementWait: 10000,
      addAnotherButtonWait: 5000,
      formResetWait: 7000,
      formResetAfterErrorWait: 5000
    }
  }, function(items) {
    document.getElementById('defaultElementWait').value = items.timeouts.defaultElementWait;
    document.getElementById('addAnotherButtonWait').value = items.timeouts.addAnotherButtonWait;
    document.getElementById('formResetWait').value = items.timeouts.formResetWait;
    document.getElementById('formResetAfterErrorWait').value = items.timeouts.formResetAfterErrorWait;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options); 
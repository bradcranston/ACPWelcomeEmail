// Master-detail state
let records = [];
let selectedIndex = null;

// DOM references
const recordListEl = document.getElementById('recordList');
const addNewBtn = document.getElementById('addNewBtn');
const saveBtn = document.getElementById('saveBtn');
// clearBtn removed: no longer using clear form button
const deleteBtn = document.getElementById('deleteBtn');
const form = document.getElementById('emailForm');
const inputs = {
  courseId: document.getElementById('courseId'),
  courseName: document.getElementById('courseName'),
  emailSubject: document.getElementById('emailSubject'),
  emailBody: document.getElementById('emailBody')
};
const filterInput = document.getElementById('filterInput');

// Render list of records
function renderRecordList() {
  const filter = filterInput.value.trim().toLowerCase();
  recordListEl.innerHTML = '';
  let anyVisible = false;
  records.forEach((rec, idx) => {
    const match = !filter ||
      rec.courseId.toLowerCase().includes(filter) ||
      rec.courseName.toLowerCase().includes(filter);
    if (!match) return;
    anyVisible = true;
    const item = document.createElement('div');
    item.className = 'record-item' + (idx === selectedIndex ? ' selected' : '');
    item.addEventListener('click', () => {
      // always auto-save current form before switching
      saveRecord();
      selectRecord(idx);
    });
    const title = document.createElement('div');
    title.className = 'record-course-id';
    title.textContent = rec.courseId;
    const subtitle = document.createElement('div');
    subtitle.className = 'record-course-name';
    subtitle.textContent = rec.courseName;
    item.appendChild(title);
    item.appendChild(subtitle);
    recordListEl.appendChild(item);
  });
  if (!anyVisible) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No records match filter.';
    recordListEl.appendChild(empty);
  }
}

// Populate form with record data or clear
function populateForm(record) {
  if (record) {
    inputs.courseId.value = record.courseId || '';
    inputs.courseName.value = record.courseName || '';
    inputs.emailSubject.value = record.emailSubject || '';
    inputs.emailBody.value = record.emailBody || '';
  } else {
    form.reset();
  }
}

// Select a record from list
function selectRecord(idx) {
  selectedIndex = idx;
  renderRecordList();
  populateForm(records[idx]);
}

// Clear form for new entry
function clearForm() {
  selectedIndex = null;
  renderRecordList();
  populateForm(null);
}

// Helper to generate a UUID (RFC4122 v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Save record and call FileMaker script
function saveRecord() {
  let data = {
    courseId: inputs.courseId.value,
    courseName: inputs.courseName.value,
    emailSubject: inputs.emailSubject.value,
    emailBody: inputs.emailBody.value
  };
  // Add or update record locally, ensure internalId exists
  if (selectedIndex === null || !records[selectedIndex] || !records[selectedIndex].internalId) {
    // New record or missing id
    data.internalId = generateUUID();
    records.push(data);
    selectedIndex = records.length - 1;
  } else {
    // Existing record, preserve internalId
    data.internalId = records[selectedIndex].internalId;
    records[selectedIndex] = data;
  }
  // Re-render list and select saved record
  renderRecordList();
  selectRecord(selectedIndex);
  // Provide JSON to FileMaker script
  data.mode = 'save';
  const param = JSON.stringify(data);
  if (window.FileMaker && FileMaker.PerformScript) {
    FileMaker.PerformScript('ManageEmailRecords', param);
  } else {
    console.log('Would call FileMaker.PerformScript with:', param);
  }
}

// Delete record and call FileMaker script
function deleteRecord() {
  if (selectedIndex === null) {
    alert('No record selected to delete.');
    return;
  }
  if (!confirm('Are you sure you want to delete this record?')) {
    return;
  }
  // Prepare delete payload
  const record = records[selectedIndex];
  const data = {
    courseId: record.courseId,
    courseName: record.courseName,
    emailSubject: record.emailSubject,
    emailBody: record.emailBody,
    internalId: record.internalId
  };
  data.mode = 'delete';
  const param = JSON.stringify(data);
  if (window.FileMaker && FileMaker.PerformScript) {
    FileMaker.PerformScript('ManageEmailRecords', param);
  } else {
    console.log('Would call FileMaker.PerformScript with:', param);
  }
  // Remove locally and refresh list
  const removedIndex = selectedIndex;
  records.splice(removedIndex, 1);
  if (records.length > 0) {
    // select next record, or last if removed was last
    const newIndex = removedIndex >= records.length ? records.length - 1 : removedIndex;
    selectedIndex = newIndex;
    renderRecordList();
    populateForm(records[selectedIndex]);
  } else {
    // no records left
    selectedIndex = null;
    renderRecordList();
    populateForm(null);
  }
}

// Load initial records from FileMaker
window.loadContactRecords = function(json) {
  try {
    records = typeof json === 'string' ? JSON.parse(json) : json;
    // Ensure all records have an internalId
    records.forEach(rec => {
      if (!rec.internalId) {
        rec.internalId = generateUUID();
      }
    });
  } catch (e) {
    console.error('Failed to parse records JSON', e);
    records = [];
  }
  selectedIndex = null;
  renderRecordList();
  if (records.length > 0) selectRecord(0);
};

// Directly load an array of records
window.loadRecords = function(arr) {
  if (!Array.isArray(arr)) {
    console.error('loadRecords expects an array of records');
    return;
  }
  // Ensure all records have an internalId
  arr.forEach(rec => {
    if (!rec.internalId) {
      rec.internalId = generateUUID();
    }
  });
  records = arr;
  selectedIndex = null;
  renderRecordList();
  if (records.length > 0) selectRecord(0);
};

// Listen for filter input changes
filterInput.addEventListener('input', () => {
  selectedIndex = null;
  renderRecordList();
});

// DOM events
addNewBtn.addEventListener('click', clearForm);
deleteBtn.addEventListener('click', deleteRecord);
saveBtn.addEventListener('click', saveRecord);

document.addEventListener('DOMContentLoaded', () => {
  // Request record load from FileMaker
  if (window.FileMaker && FileMaker.PerformScript) {
    FileMaker.PerformScript('LoadEmailRecords', '');
  } else {
    console.warn('FileMaker.PerformScript not available');
  }
});

// Attach autosave function to window
window.autosave = function() {
  saveRecord();
};
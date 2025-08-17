document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refresh');

  function updateFromActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !/^https?:\/\/(www\.)?leetcode\.com\//i.test(tab.url || '')) {
        statusEl.textContent = 'Open a LeetCode problem tab';
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'getProblem' }, (resp) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Student Buddy is inactive on this tab';
          return;
        }
        statusEl.textContent = resp?.problemName ? `Detected: ${resp.problemName}` : 'No problem detected';
      });
    });
  }

  refreshBtn.addEventListener('click', updateFromActiveTab);
  updateFromActiveTab();
});

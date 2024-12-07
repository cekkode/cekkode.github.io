const scriptVer = '1.3'; console.log("Ver: " + scriptVer);

// Load OAuth 2.0 client credentials from JSON
const { client_id, client_secret, redirect_uris, auth_uri, token_uri } = JSON.parse(
    window.env.GOOGLE_OAUTH_CREDENTIALS
);

document.getElementById('turnPdfButton').addEventListener('click', async () => {
  const printfriendlyApiKey = document.getElementById('printfriendlyApiKey').value;
  const googleDriveApiKey = document.getElementById('googleDriveApiKey').value;
  const urls = document.getElementById('urls').value.split('\n');
  const status = document.getElementById('status');
  status.innerHTML = '';

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const folderName = `pdf_${timestamp}`;

  try {
      const folderId = await createGoogleDriveFolder(googleDriveApiKey, folderName);
      for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          status.innerHTML = `Processing: ${url} (${i + 1}/${urls.length})<br>`;
          updateProgress(i, urls.length); // Update the progress bar
        
          const pdfUrl = await createPdf(printfriendlyApiKey, url);
          await new Promise((resolve) => setTimeout(resolve, 1200)); // Respecting rate limit
          await uploadToGoogleDrive(googleDriveApiKey, folderId, pdfUrl, url);
          status.innerHTML += `Successfully uploaded: ${url}<br>`;
      }
      status.innerHTML += `All files processed successfully!`;
  } catch (error) {
      status.innerHTML = `Error: ${error.message}`;
  }
});

async function createPdf(apiKey, url) {
  const response = await fetch(`https://api.printfriendly.com/v2/pdf/create?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: new URLSearchParams({ page_url: url, output_type: 'attachment' })
  });
  const data = await response.json();
  if (data.status !== 'success') throw new Error('Failed to create PDF');
  return data.file_url;
}

function extractSitename(url) {
  try {
      const parsedUrl = new URL(url);
      // Remove www. and take the hostname
      return parsedUrl.hostname.replace('www.', '').replace(/\./g, '-');
  } catch (error) {
      // Fallback to timestamp if URL is invalid
      return `pdf_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  }
}

async function createGoogleDriveFolder(apiKey, url) {
  const folderName = `pdf-${extractSitename(url)}`;
  
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
      })
  });

  const data = await response.json();
  if (!response.ok) throw new Error('Failed to create folder');
  return data.id;
}

async function uploadToGoogleDrive(apiKey, folderId, fileUrl, originalUrl) {
  const fileName = originalUrl.replace(/\.|\//g, '-') + '.pdf';
  const response = await fetch(fileUrl);
  const fileBlob = await response.blob();

  const uploadResponse = await retryWithBackoff(async () => {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=media`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/pdf',
          'Content-Length': fileBlob.size
      },
      body: fileBlob
  });
  if (!res.ok) throw new Error(`Failed to upload file: ${res.status} - ${res.statusText}`);
  return await res.json();
  });
  
  // Move file to the created folder
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploadResponse.id}`, {
      method: 'PATCH',
      headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          name: fileName,
          parents: [folderId]
      })
  });
}

const progressIndicator = document.getElementById('progress-indicator');
const progressBar = document.getElementById('progress-bar');

// Update the progress bar during file processing
const updateProgress = (currentIndex, totalFiles) => {
  const progress = (currentIndex / totalFiles) * 100;
  progressIndicator.style.width = `${progress}%`;
};

// Reset the progress bar
const resetProgress = () => {
  progressIndicator.style.width = '0%';
};

const cancelButton = document.getElementById('cancelButton');
let processingActive = false;

// Toggle the cancel button visibility and processing state
const toggleCancelButton = (visible) => {
  cancelButton.style.display = visible ? 'inline' : 'none';
  processingActive = visible;
};

// Add click handler for the cancel button
cancelButton.addEventListener('click', () => {
  toggleCancelButton(false);
  status.innerHTML = 'Processing cancelled.';
  resetProgress();
});

async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      status.innerHTML += `Retry attempt ${retries}/${maxRetries} - ${error.message}<br>`;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw new Error('Maximum retries reached. Unable to complete the operation.');
}

// Function to save credentials to localStorage
function saveCredentials() {
  const printfriendlyApiKey = document.getElementById('printfriendlyApiKey').value;
  const googleDriveApiKey = document.getElementById('googleDriveApiKey').value;
  const googleOauthCredentials = document.getElementById('googleOauthCredentials').value;

  // Validate inputs before saving
  if (printfriendlyApiKey && googleDriveApiKey && googleOauthCredentials) {
      try {
          // Parse OAuth credentials to ensure it's valid JSON
          JSON.parse(googleOauthCredentials);

          localStorage.setItem('printfriendlyApiKey', printfriendlyApiKey);
          localStorage.setItem('googleDriveApiKey', googleDriveApiKey);
          localStorage.setItem('googleOauthCredentials', googleOauthCredentials);
          
          alert('Credentials saved successfully!');
      } catch (error) {
          alert('Invalid Google OAuth Credentials JSON');
      }
  }
}

// Function to load saved credentials
function loadSavedCredentials() {
  const printfriendlyApiKey = localStorage.getItem('printfriendlyApiKey');
  const googleDriveApiKey = localStorage.getItem('googleDriveApiKey');
  const googleOauthCredentials = localStorage.getItem('googleOauthCredentials');

  if (printfriendlyApiKey) document.getElementById('printfriendlyApiKey').value = printfriendlyApiKey;
  if (googleDriveApiKey) document.getElementById('googleDriveApiKey').value = googleDriveApiKey;
  if (googleOauthCredentials) document.getElementById('googleOauthCredentials').value = googleOauthCredentials;
}

// Modify the existing script to use stored credentials
document.getElementById('turnPdfButton').addEventListener('click', async () => {
  const printfriendlyApiKey = document.getElementById('printfriendlyApiKey').value;
  const googleDriveApiKey = document.getElementById('googleDriveApiKey').value;
  const googleOauthCredentials = document.getElementById('googleOauthCredentials').value;

  // Parse OAuth credentials
  const { client_id, client_secret, redirect_uris, auth_uri, token_uri } = JSON.parse(googleOauthCredentials);

  // Rest of the existing script remains the same...
});

// Load saved credentials when the page loads
document.addEventListener('DOMContentLoaded', loadSavedCredentials);

// Add event listeners to save credentials after input
document.getElementById('printfriendlyApiKey').addEventListener('change', saveCredentials);
document.getElementById('googleDriveApiKey').addEventListener('change', saveCredentials);
document.getElementById('googleOauthCredentials').addEventListener('change', saveCredentials);
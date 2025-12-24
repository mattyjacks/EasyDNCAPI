let apiKey = '';
let csvData = [];
let headers = [];
let processedData = [];
let phoneColumnIndex = -1;

const API_ENDPOINT = 'https://www.easydnc.org/api/check_dnc.php';
const COST_PER_LOOKUP = 0.025;

document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('clearApiKey').addEventListener('click', clearApiKey);
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('processBtn').addEventListener('click', showPriceConfirmation);
    document.getElementById('confirmBtn').addEventListener('click', processDNCChecks);
    document.getElementById('cancelBtn').addEventListener('click', cancelProcessing);
    document.getElementById('downloadComplete').addEventListener('click', () => downloadCSV('complete'));
    document.getElementById('downloadClean').addEventListener('click', () => downloadCSV('clean'));
    document.getElementById('resetBtn').addEventListener('click', confirmReset);
}

function loadApiKey() {
    const stored = localStorage.getItem('easydnc_api_key');
    if (stored) {
        apiKey = stored;
        document.getElementById('apiKey').value = stored;
        showStatus('apiKeyStatus', 'API Key loaded from storage', 'success');
        document.getElementById('uploadSection').style.display = 'block';
    }
}

function saveApiKey() {
    const input = document.getElementById('apiKey').value.trim();
    if (!input) {
        showStatus('apiKeyStatus', 'Please enter an API key', 'error');
        return;
    }
    
    apiKey = input;
    localStorage.setItem('easydnc_api_key', apiKey);
    showStatus('apiKeyStatus', 'API Key saved successfully', 'success');
    document.getElementById('uploadSection').style.display = 'block';
}

function clearApiKey() {
    apiKey = '';
    localStorage.removeItem('easydnc_api_key');
    document.getElementById('apiKey').value = '';
    showStatus('apiKeyStatus', 'API Key cleared', 'success');
    document.getElementById('uploadSection').style.display = 'none';
    resetApp();
}

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('fileName').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        parseCSV(e.target.result);
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        alert('CSV file is empty');
        return;
    }
    
    headers = parseCSVLine(lines[0]);
    csvData = lines.slice(1).map(line => parseCSVLine(line));
    
    csvData = csvData.filter(row => row.some(cell => cell.trim()));
    
    displayPreview();
    populateColumnSelector();
    document.getElementById('columnSection').style.display = 'block';
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    
    return result.map(cell => cell.trim());
}

function displayPreview() {
    const table = document.getElementById('previewTable');
    table.innerHTML = '';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const previewRows = csvData.slice(0, 5);
    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function populateColumnSelector() {
    const select = document.getElementById('phoneColumn');
    select.innerHTML = '';
    
    headers.forEach((header, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${header} (Column ${index + 1})`;
        select.appendChild(option);
    });
}

function showPriceConfirmation() {
    phoneColumnIndex = parseInt(document.getElementById('phoneColumn').value);
    
    const totalNumbers = csvData.length;
    const estimatedCost = (totalNumbers * COST_PER_LOOKUP).toFixed(2);
    
    document.getElementById('totalNumbers').textContent = totalNumbers;
    document.getElementById('estimatedCost').textContent = `$${estimatedCost}`;
    
    document.getElementById('columnSection').style.display = 'none';
    document.getElementById('priceSection').style.display = 'block';
}

function cancelProcessing() {
    document.getElementById('priceSection').style.display = 'none';
    document.getElementById('columnSection').style.display = 'block';
}

async function processDNCChecks() {
    document.getElementById('priceSection').style.display = 'none';
    document.getElementById('progressSection').style.display = 'block';
    
    processedData = [];
    const total = csvData.length;
    let completed = 0;
    let totalCharged = 0;
    let lastBalance = 0;
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < csvData.length; i++) {
        const row = [...csvData[i]];
        const phoneNumber = row[phoneColumnIndex];
        
        try {
            const result = await checkDNC(phoneNumber);
            
            row.unshift(currentDate);
            row.unshift(result.status);
            
            processedData.push({
                row: row,
                dnc: result.dnc,
                charged: result.charged,
                rawResult: result
            });
            
            totalCharged += result.charged || 0;
            lastBalance = result.balance || lastBalance;
            
        } catch (error) {
            row.unshift(currentDate);
            row.unshift(`❌ Error: ${error.message}`);
            
            processedData.push({
                row: row,
                dnc: null,
                charged: 0,
                rawResult: null
            });
        }
        
        completed++;
        updateProgress(completed, total, lastBalance);
        
        await sleep(100);
    }
    
    showResults(totalCharged);
}

async function checkDNC(phoneNumber) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number: phoneNumber })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        if (error.message === 'Failed to fetch') {
            throw new Error('CORS/Network error. The API may not allow requests from localhost. Try using a browser extension to disable CORS or deploy to a web server.');
        }
        throw error;
    }
}

function updateProgress(completed, total, balance) {
    const percentage = (completed / total) * 100;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${completed} / ${total}`;
    
    if (balance !== undefined) {
        document.getElementById('balanceText').textContent = `Current Balance: $${balance.toFixed(2)}`;
    }
}

function showResults(totalCharged) {
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
    
    const totalChecked = processedData.length;
    const onDNC = processedData.filter(item => item.dnc === true).length;
    const notOnDNC = processedData.filter(item => item.dnc === false).length;
    
    document.getElementById('totalChecked').textContent = totalChecked;
    document.getElementById('onDNC').textContent = onDNC;
    document.getElementById('notOnDNC').textContent = notOnDNC;
    document.getElementById('totalCost').textContent = `$${totalCharged.toFixed(2)}`;
}

function downloadCSV(type) {
    let dataToDownload;
    let filename;
    
    const newHeaders = ['DNC STATUS', 'Date Checked', ...headers];
    
    if (type === 'complete') {
        dataToDownload = processedData.map(item => item.row);
        filename = 'dnc_complete.csv';
    } else {
        dataToDownload = processedData
            .filter(item => item.dnc === false)
            .map(item => item.row);
        filename = 'dnc_clean.csv';
    }
    
    const csvContent = [
        newHeaders.map(escapeCSVValue).join(','),
        ...dataToDownload.map(row => row.map(escapeCSVValue).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeCSVValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    const stringValue = String(value);
    
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
}

function confirmReset() {
    if (confirm('Are you sure you want to process another file? Current results will be cleared.')) {
        resetApp();
    }
}

function resetApp() {
    csvData = [];
    headers = [];
    processedData = [];
    phoneColumnIndex = -1;
    
    document.getElementById('csvFile').value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('columnSection').style.display = 'none';
    document.getElementById('priceSection').style.display = 'none';
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    
    if (apiKey) {
        document.getElementById('uploadSection').style.display = 'block';
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

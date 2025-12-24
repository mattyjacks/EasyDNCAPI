# Running on Localhost

The CORS error occurs because browsers block cross-origin requests from localhost to external APIs for security reasons.

## Solution: Use the Proxy Server

I've created a simple Node.js proxy server that bypasses CORS restrictions for local development.

### Steps:

1. **Start the Proxy Server**
   
   Open a terminal in the `EasyDNCAPI` folder and run:
   ```powershell
   node proxy-server.js
   ```
   
   Or use npm:
   ```powershell
   npm start
   ```

2. **Open the Application**
   
   Open `v1/index.html` in your browser (you can use file:// or run a local server).
   
   The application will automatically detect localhost and use the proxy server at `http://localhost:3000`.

3. **Use the Application Normally**
   
   Enter your API key and process CSV files as usual. All requests will go through the proxy server which adds CORS headers.

### What the Proxy Does

- Runs on `http://localhost:3000`
- Forwards API requests to `https://www.easydnc.org/api/check_dnc.php`
- Adds CORS headers to allow browser requests
- Passes through your API key and request data

### When Deployed

When you deploy this to a real web server (not localhost), the application automatically switches back to calling the EasyDNC API directly without the proxy.

### Keep the Proxy Running

Leave the proxy server running in the terminal while you use the application. Press `Ctrl+C` to stop it when done.

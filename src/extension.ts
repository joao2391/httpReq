
import * as vscode from 'vscode';
import axios from 'axios';

// Postman-like Webview Panel
function getWebviewContent() {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>VSCode HTTP Client</title>
		<style>
			body { font-family: sans-serif; margin: 0; padding: 0; background: #1e1e1e; color: #d4d4d4; }
			.container { padding: 16px; }
			input, select, textarea { width: 100%; margin-bottom: 8px; padding: 8px; border-radius: 4px; border: 1px solid #333; background: #252526; color: #d4d4d4; }
			label { font-weight: bold; margin-top: 8px; display: block; }
			button { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
			button:hover { background: #005a9e; }
			.response { margin-top: 16px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px; }
			.response-container { margin-top: 16px; }
			.response-header { 
				display: flex; 
				justify-content: space-between; 
				align-items: center; 
				background: #252526; 
				padding: 8px 12px; 
				border-radius: 4px 4px 0 0;
				border-bottom: 1px solid #3c3c3c;
			}
			.response-title { font-weight: bold; color: #d4d4d4; font-size: 12px; }
			.copy-btn { 
				background: #3c3c3c; 
				color: #d4d4d4; 
				border: none; 
				padding: 4px 10px; 
				border-radius: 3px; 
				cursor: pointer; 
				font-size: 11px;
			}
			.copy-btn:hover { background: #4a4a4a; }
			.response { 
				margin: 0; 
				padding: 12px; 
				border-radius: 0 0 4px 4px;
				white-space: pre-wrap; 
				max-height: 400px; 
				overflow: auto; 
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
				font-size: 13px;
				line-height: 1.4;
				color: #d4d4d4;
				background: #1e1e1e;
			}
			.response.json { color: #9cdcfe; }
			.response.json .string { color: #ce9178; }
			.response.json .number { color: #b5cea8; }
			.response.json .boolean { color: #569cd6; }
			.response.json .null { color: #569cd6; }
			.response.json .key { color: #9cdcfe; }
		</style>
	</head>
	<body>
		<div class="container">
			<label for="method">Method</label>
			<select id="method">
				<option>GET</option>
				<option>POST</option>
				<option>PUT</option>
				<option>DELETE</option>
				<option>PATCH</option>
			</select>
			<label for="url">URL</label>
			<input id="url" type="text" placeholder="https://api.example.com/data" />
			<label for="headers">Headers (JSON)</label>
			<textarea id="headers" rows="2" placeholder='{"Authorization": "Bearer ..."}'></textarea>
			<label for="body">Body (for POST/PUT/PATCH)</label>
			<textarea id="body" rows="4" placeholder='{"key": "value"}'></textarea>
		<button id="send">Send Request</button>
		<div class="response-container">
			<div class="response-header">
				<span class="response-title">Response</span>
				<button class="copy-btn" id="copyBtn">Copy</button>
			</div>
			<pre class="response" id="response"></pre>
		</div>
	</div>
	<script type="text/javascript">
			var vscodeApi = acquireVsCodeApi();
			var sendBtn = document.getElementById('send');
			var responseEl = document.getElementById('response');
			var copyBtn = document.getElementById('copyBtn');
			
			sendBtn.addEventListener('click', function() {
				sendBtn.textContent = 'Loading...';
				sendBtn.disabled = true;
				var method = document.getElementById('method').value;
				var url = document.getElementById('url').value;
				var headers = {};
				try { 
					headers = JSON.parse(document.getElementById('headers').value || '{}'); 
				} catch (e) { 
					// ignore
				}
				var body = document.getElementById('body').value;
				vscodeApi.postMessage({ method: method, url: url, headers: headers, body: body });
			});
			
			window.addEventListener('message', function(event) {
				sendBtn.textContent = 'Send Request';
				sendBtn.disabled = false;
				
				var response = event.data.response;
				
				// Try to format as JSON
				try {
					var json = JSON.parse(response);
					response = JSON.stringify(json, null, 2);
					responseEl.innerHTML = syntaxHighlight(json);
					responseEl.className = 'response json';
				} catch (e) {
					responseEl.textContent = response;
					responseEl.className = 'response';
				}
			});
			
			function syntaxHighlight(json) {
				json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
					var cls = 'number';
					if (/^"/.test(match)) {
						if (/:$/.test(match)) {
							cls = 'key';
						} else {
							cls = 'string';
						}
					} else if (/true|false/.test(match)) {
						cls = 'boolean';
					} else if (/null/.test(match)) {
						cls = 'null';
					}
					return '<span class="' + cls + '">' + match + '</span>';
				});
			}
			
			copyBtn.addEventListener('click', function() {
				navigator.clipboard.writeText(responseEl.textContent);
				copyBtn.textContent = 'Copied!';
				setTimeout(function() {
					copyBtn.textContent = 'Copy';
				}, 1500);
			});
		</script>
	</body>
	</html>
	`;
}
// Register the Postman-like UI command
function registerUI(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('http-req.openHttpClient', () => {
		
		const panel = vscode.window.createWebviewPanel('httpClient','HTTP Client',vscode.ViewColumn.One,{ enableScripts: true });
		
		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(async (msg) => {
			let responseText = '';
			try {
				const axiosConfig: any = {
					method: msg.method,
					url: msg.url,
					headers: msg.headers,
					data: (["POST", "PUT", "PATCH"].includes(msg.method) && msg.body) ? msg.body : undefined
				};
				const res = await require('axios')(axiosConfig);
				responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
			} catch (err: any) {
				responseText = `Error: ${err.message}`;
			}
			panel.webview.postMessage({ response: responseText });
		});

		context.subscriptions.push(panel);
	});
	context.subscriptions.push(disposable);
}
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	registerUI(context);

	// Register sidebar view
	class HttpReqTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
		getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
			return element;
		}
		getChildren(): vscode.TreeItem[] {
			const item = new vscode.TreeItem('Open HTTP Client');
			item.command = { command: 'http-req.openHttpClient', title: 'Open HTTP Client' };
			item.iconPath = new vscode.ThemeIcon('globe');
			return [item];
		}
	}

	const treeProvider = new HttpReqTreeProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('httpReqView', treeProvider));

	// Helper to prompt for URL, method, and (optionally) body test-vsext
	async function promptAndRequest(method: string) {
		const url = await vscode.window.showInputBox({ prompt: `Enter URL for ${method} request` });
		if (!url) {
			vscode.window.showErrorMessage('No URL provided.');
			return;
		}
		let body: string | undefined = undefined;
		if (["POST", "PUT", "PATCH"].includes(method)) {
			body = await vscode.window.showInputBox({ prompt: `Enter request body (JSON or text, leave empty for none)` });
		}
		let responseText = '';
		try {
			const axiosConfig: any = {
				method,
				url,
				headers: body ? { 'Content-Type': 'application/json' } : undefined,
				data: body || undefined
			};
			const res = await axios(axiosConfig);
			responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
		} catch (err: any) {
			responseText = `Error: ${err.message}`;
		}
		// Try to pretty-print JSON, else show as text
		let displayText = responseText;
		try {
			displayText = JSON.stringify(JSON.parse(responseText), null, 2);
		} catch {}
		const channel = vscode.window.createOutputChannel(`HTTP ${method}`);
		channel.appendLine(displayText);
		channel.show();
	}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "http-req" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const commands = [
		{ id: 'http-req.httpGet', method: 'GET' },
		{ id: 'http-req.httpPost', method: 'POST' },
		{ id: 'http-req.httpPut', method: 'PUT' },
		{ id: 'http-req.httpDelete', method: 'DELETE' },
		{ id: 'http-req.httpPatch', method: 'PATCH' },
	];
	for (const cmd of commands) {
		const disposable = vscode.commands.registerCommand(cmd.id, () => promptAndRequest(cmd.method));
		context.subscriptions.push(disposable);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

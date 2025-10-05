
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
			.response { margin-top: 16px; background: #232323; padding: 12px; border-radius: 4px; white-space: pre-wrap; max-height: 300px; overflow: auto; }
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
			<div class="response" id="response"></div>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			document.getElementById('send').onclick = () => {
				const method = document.getElementById('method').value;
				const url = document.getElementById('url').value;
				let headers = {};
				try { headers = JSON.parse(document.getElementById('headers').value || '{}'); } catch {}
				const body = document.getElementById('body').value;
				vscode.postMessage({ method, url, headers, body });
			};
			window.addEventListener('message', event => {
				const { response } = event.data;
				document.getElementById('response').textContent = response;
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
	});
	context.subscriptions.push(disposable);
}
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	registerUI(context);
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

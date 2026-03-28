// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
const engine = require("php-parser");

function handleParse(node: any) {
	const results: any = [];
	function traverse(node: any) {
		if (!node) return;
		if (node.kind == "expressionstatement") {
			return traverse(node.expression);
		}
		if (node.kind == "call" &&
			node.what?.kind == "propertylookup" &&
			node.what?.offset?.name == "IncludeComponent" &&
			node.arguments?.length >= 2
		) {
			let localResult = {arg1: {}, arg2: {}};
			if (node.arguments[0]?.kind == "string") {
				const argData = node.arguments[0];
				localResult['arg1'] = {
					value: argData.value,
					start: argData.loc?.start,
					end: argData.loc?.end
				}
			}	
			if (node.arguments[1]?.kind == "string") {
				const argData = node.arguments[1];
				localResult['arg2'] = {
					value: argData.value,
					start: argData.loc?.start,
					end: argData.loc?.end
				}
			}	
			if (localResult['arg1'] || localResult['arg2']) {
				results.push(localResult);
			}
		}	


		if (node.children) {
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				traverse(child);
			}
		}
		if (node.body?.children) {
			for (let i = 0; i < node.body.children.length; i++) {
				const child = node[i];
				traverse(child);
			}
		}
	}

	traverse(node);
	return results;
}

function findBitrixRoot(filePath: string) {

}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bitrixassist" is now active!');

	const disposable = vscode.commands.registerCommand('bitrixassist.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from bitrixAssist!');
	});
	context.subscriptions.push(disposable);


	const parser = new engine({
		ast: {
			withPositions: true
		},
		lexer: {
			short_tags: true
		}
	})
	const linkProvider: vscode.DocumentLinkProvider = {provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
		console.log("LinkProvider trigger");
		const links: vscode.DocumentLink[] = [];
        const text = document.getText();
		const code = parser.parseCode(text);
		const data = handleParse(code);
		
		let loc, start, end, targeUrl;
		data.forEach((el: any) => {
			// new vscode.Position()
			if (el.arg1) {
				start = new vscode.Position(el.arg1.start.line-1,el.arg1.start.column);
				end = new vscode.Position(el.arg1.end.line-1,el.arg1.end.column);
				loc = new vscode.Range(start,end);
				targeUrl = vscode.Uri.parse("https://google.com");
				links.push(new vscode.DocumentLink(loc, targeUrl))
			}
			if (el.arg2) {
				start = new vscode.Position(el.arg2.start.line-1,el.arg2.start.column);
				end = new vscode.Position(el.arg2.end.line-1,el.arg2.end.column);
				loc = new vscode.Range(start,end);
				targeUrl = vscode.Uri.parse("https://microsoft.com");
				links.push(new vscode.DocumentLink(loc, targeUrl))
			}
		});

		return links;
	}};

	const selector: vscode.DocumentSelector = {'language': 'php'};

	let provider = vscode.languages.registerDocumentLinkProvider(selector, linkProvider)
	context.subscriptions.push(provider);

}

// This method is called when your extension is deactivated
export function deactivate() {}

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
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
	const folderName = "bitrix";
	let currentPath = path.resolve(filePath);
	
	if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
		currentPath = path.dirname(currentPath);
	}

	while (true) {
		const targetFolder = path.join(currentPath, folderName);

		if (fs.existsSync(targetFolder) && fs.statSync(targetFolder).isDirectory()) {
			return currentPath;
		}

		const parentPath = path.dirname(currentPath);

		if (parentPath === currentPath) {
			return null;
		}

		currentPath = parentPath;
	}
}

async function searchForComponent(rootPath: string, namespace: string, componentName: string) {
	const globSchemas = [
		`${rootPath}/local/components/${namespace}/${componentName}/component.php`,
		`${rootPath}/bitrix/components/${namespace}/${componentName}/component.php` 
	];
	let results: string[] = [];
	for (let i = 0; i < globSchemas.length; i++) {
		results = results.concat(await glob.glob(globSchemas[i]));
	}
	return results;
}

async function searchForTemplate(rootPath: string, namespace: string, componentName: string, templateName: string) {
	if (templateName.trim() == "") {
		templateName = ".default";
	}
	const fileNamePattern = "{template.php,element.php}";
	const globSchemas = [
		`${rootPath}/local/templates/*/components/${namespace}/${componentName}/${templateName}/${fileNamePattern}`,
		`${rootPath}/local/components/${namespace}/${componentName}/templates/${templateName}/${fileNamePattern}`,
		`${rootPath}/bitrix/templates/*/components/${namespace}/${componentName}/${templateName}/${fileNamePattern}`,
		`${rootPath}/bitrix/components/${namespace}/${componentName}/templates/${templateName}/${fileNamePattern}` 
	];
	let results: string[] = [];
	for (let i = 0; i < globSchemas.length; i++) {
		results = results.concat(await glob.glob(globSchemas[i]));
	}
	return results;
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
	const linkProvider: vscode.DocumentLinkProvider = {async provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken) {
		console.log("LinkProvider trigger");
		const links: vscode.DocumentLink[] = [];
		const rootDir = findBitrixRoot(document.uri?.fsPath);
		if (!rootDir) {
			return links;
		}
		const text = document.getText();
		const code = parser.parseCode(text);
		const data = handleParse(code);
		
		let loc, start, end, targetUrl;
		for (let i = 0; i < data.length; i++) {
			const el = data[i];
			if (el.arg1) {
				const [namespace, componentName] = el.arg1.value.split(':');
				const componentPaths = await searchForComponent(rootDir,namespace,componentName);
				if (componentPaths[0]) {
					start = new vscode.Position(el.arg1.start.line-1,el.arg1.start.column);
					end = new vscode.Position(el.arg1.end.line-1,el.arg1.end.column);
					loc = new vscode.Range(start,end);						
					targetUrl = vscode.Uri.file(componentPaths[0]);
					links.push(new vscode.DocumentLink(loc, targetUrl))
				}

				if (el.arg2) {
					const templatePaths = await searchForTemplate(rootDir, namespace, componentName, el.arg2.value);
					// if (templatePaths[0]) {
					if (templatePaths[0]) {
						start = new vscode.Position(el.arg2.start.line-1,el.arg2.start.column);
						end = new vscode.Position(el.arg2.end.line-1,el.arg2.end.column);
						loc = new vscode.Range(start,end);
						targetUrl = vscode.Uri.file(templatePaths[0]);
						links.push(new vscode.DocumentLink(loc, targetUrl))
					}
				}
			}
		}

		return links;
	}};

	const selector: vscode.DocumentSelector = {'language': 'php'};

	let provider = vscode.languages.registerDocumentLinkProvider(selector, linkProvider)
	context.subscriptions.push(provider);

}

// This method is called when your extension is deactivated
export function deactivate() {}

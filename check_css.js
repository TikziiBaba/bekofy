const fs = require('fs');
const { getCSSLanguageService, TextDocument } = require('vscode-css-languageservice');

const cssContent = fs.readFileSync('src/css/app.css', 'utf8');
const document = TextDocument.create('file:///src/css/app.css', 'css', 1, cssContent);
const ls = getCSSLanguageService();

ls.configure({
    lint: {
        compatibleVendorPrefixes: 'warning',
        vendorPrefix: 'warning',
        duplicateProperties: 'warning',
        emptyRules: 'warning',
        importStatement: 'warning',
        boxModel: 'warning',
        universalSelector: 'ignore',
        zeroUnits: 'warning',
        fontFaceProperties: 'warning',
        hexColorLength: 'warning',
        argumentsInColorFunction: 'warning',
        unknownProperties: 'warning',
        unknownVendorSpecificProperties: 'warning',
        propertyIgnoredDueToDisplay: 'warning',
        important: 'ignore',
        float: 'warning',
        idSelector: 'ignore'
    }
});

const stylesheet = ls.parseStylesheet(document);
const diagnostics = ls.doValidation(document, stylesheet);

console.log(`Found ${diagnostics.length} problems:`);
diagnostics.forEach(d => {
  console.log(`Line ${d.range.start.line + 1}: ${d.message} (${d.code})`);
});

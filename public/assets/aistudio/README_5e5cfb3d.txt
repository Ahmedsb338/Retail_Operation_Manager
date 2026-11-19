RETAIL OPERATION MANAGER — APPS SCRIPT SOURCE FILES

Contents:
- Code.js: Apps Script backend source.
- index.html: Apps Script HTML template.
- index-script.html: client-side script partial included by index.html.

Important recovery note:
The recovered Code.gs source used HtmlService.createHtmlOutputFromFile('index'),
which does not evaluate the Apps Script template directive in index.html.
For this integration copy only, doGet() was corrected to use
HtmlService.createTemplateFromFile('index').evaluate().
The original recovered Library file was not modified.

This bundle is for source inspection and feature porting into the existing
React + Express application. Do not deploy this Apps Script project as a
replacement for the existing Google Cloud application.

Data note:
The Apps Script backend contains a list of 14 branch names plus two blank
rows, but that is NOT an authoritative 14-branch mapping dataset: branch
codes, manager names, and areas are not established by that list. Do not
fabricate these values.

Review note:
The Apps Script source is a legacy reference implementation. Inspect and
port verified business behavior only. Do not blindly copy its authentication,
spreadsheet storage, dynamic column operations, credentials, or deployment
assumptions into the React + Express application.

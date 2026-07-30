Step 1 — Open the ZIP
Use 7-Zip, WinRAR, or Windows Explorer.
Password = backup password (not your login password).

Step 2 — Decrypt the .enc file
With Node.js installed, put the script next to your extracted files:

Script: backend/scripts/decrypt-school-export.mjs

cd path/to/extracted/folder
node path/to/ntg-sms-v1/backend/scripts/decrypt-school-export.mjs
Or with explicit paths:

node decrypt-school-export.mjs school-data.json.enc school-data.json.enc.meta school-data.json
Enter the same backup password when prompted. You’ll get school-data.json — readable JSON with all exported sections.

If you only have README + one other file
You need both school-data.json.enc and school-data.json.enc.meta inside the ZIP. If one is missing, extract again with the backup password or re-export after the backend restart.
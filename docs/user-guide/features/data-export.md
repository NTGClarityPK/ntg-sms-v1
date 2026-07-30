# Alma — School data backup (user guide)

A short guide for school administrators who export a secure backup of their school’s data from Alma.

---

## Who can use this?

- **School admin** or **super admin** only  
- You must be **logged in** and have a **branch selected** in the header  

**Where:** **Settings** → **Data export** tab  

---

## What you get

A **password-protected ZIP file** containing your school’s **database records** (students, staff, fees, attendance, timetables, messages, settings, and more).

| Included | Not included |
|----------|----------------|
| School and branch details | Uploaded files (photos, attachments, library files) |
| Students, staff, parents (links) | Login passwords or API keys |
| Fees, attendance, assessments, results | Push notification tokens |
| Messages, events, library/inventory records | Automatic cloud backup (you store the ZIP yourself) |

The export is **encrypted twice**: the ZIP is locked with your **backup password**, and the data file inside is encrypted again for extra protection.

---

## Before you export

1. Read the **security warning** and tick **I understand**.  
2. Choose **scope**:  
   - **Entire school (all branches)** — all active branches in your organisation  
   - **Current branch only** — only the branch selected in the header  
3. Enter your **Alma login password** (proves it is really you).  
4. Choose a strong **backup password** (min. 12 characters, with upper and lower case, a number, and a symbol).  
   - **Confirm** the backup password.  
   - **Save this password somewhere safe** — Alma **cannot** reset or recover it.  
5. Click **Export school data** and wait for the download (large schools may take a minute or two).

### Two passwords — do not mix them up

| Password | Used for |
|----------|----------|
| **Login password** | Alma sign-in and confirming export |
| **Backup password** | Opening the ZIP and decrypting the data file |

---

## Limits

- **One successful export per school every 24 hours** (across all branches).  
- If you exported recently, the screen shows when you can export again.  
- **Single sign-on (Google/Microsoft) accounts** cannot export this way — use an admin account that signs in with email and password.

---

## What’s inside the ZIP?

| File | Purpose |
|------|---------|
| `school-data.json.enc` | Encrypted school data |
| `school-data.json.enc.meta` | Info needed to decrypt (keep with the `.enc` file) |
| `README.txt` | Brief technical notes |

You need **both** the `.enc` and `.meta` files to decrypt.

---

## How to open and read your backup

### Step 1 — Open the ZIP

Use **7-Zip**, **WinRAR**, or **Windows Explorer**.  
Password = your **backup password** (not your login password).

### Step 2 — Decrypt to readable JSON

You need **[Node.js](https://nodejs.org/)** installed once on your computer.

1. Extract the ZIP to a folder.  
2. Copy the decrypt script from the Alma project:  
   `backend/scripts/decrypt-school-export.mjs`  
3. Open a terminal in that folder and run:

```bash
node decrypt-school-export.mjs
```

Or with full paths:

```bash
node decrypt-school-export.mjs school-data.json.enc school-data.json.enc.meta school-data.json
```

4. Enter your **backup password** when prompted.  
5. Open **`school-data.json`** in any text editor or JSON viewer.

---

## Keep your backup safe

- Store on a **secure drive** or offline backup you control.  
- **Do not** email the ZIP or put it in a **public** cloud folder.  
- **Do not** share the backup password.  
- Your school is responsible for protecting exported personal data (GDPR / local rules may apply).

---

## Restore into Alma?

Phase 1 is **export only**. There is no **Import / Restore** button in Alma yet. The JSON is for your records, migration planning, or external tools.

---

## Common issues

| Problem | What to do |
|---------|------------|
| “Invalid account password” | Use the same password as Alma **login**, not the backup password. |
| Logged out after export | Sign in again; newer versions should not log you out. Refresh the page if needed. |
| “Export limit reached” | Wait until the time shown (24 hours since last successful export). |
| Cannot open ZIP | Use the **backup** password; try 7-Zip if Windows fails. |
| Decrypt fails | Wrong backup password, or missing `.meta` file — re-extract the ZIP. |
| SSO / Google login | Use a password-based school admin account for export. |

---

## Need help?

Contact your Alma administrator or support if export fails repeatedly or you need the database migration applied on your server (`verify_user_password` for password checks).

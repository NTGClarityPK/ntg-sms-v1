# 👕 Inventory (Uniforms)

Uniform items, parent requests, staff approval, and issuance history.

## 📋 Overview

**Path:** Sidebar → **Inventory** (plan feature **Inventory management** where enabled)

| Tab | Who |
| --- | --- |
| **Manage items** | Staff with inventory edit |
| **View requests** | Staff |
| **Issuance history** | Staff |
| **Request uniform** | Parents (jumps to `/uniform-request`) |

Parents also reach requests via sidebar **Request uniform**.

---

## 📦 Manage items

Define uniform items, sizes (from **Settings → Inventory**), and stock levels. Stock is decremented when items are **issued**.

Staff can **direct issue** to a student without a prior parent request where the UI offers it.

---

## 📋 Request workflow

| Status | Meaning |
| --- | --- |
| **pending** | Submitted, awaiting staff |
| **approved** | Accepted, ready to issue |
| **issued** | Handed to student |
| (also **rejected** / cancelled paths where shown) |

Staff on **View requests**: approve, reject, or **Mark issued**. Parents can cancel own **pending** requests.

---

## 🕒 Issuance history

Audit of what was issued, when, and by whom — filter by student/item/date.

---

## 🧍 Request uniform (parent)

1. **Inventory → Request uniform** or sidebar **Request uniform**.
2. Select child if prompted.
3. Choose items/sizes.
4. Submit — track status under staff **View requests**.

---

## 💡 Tips & Best Practices

- Configure categories and sizes in **Settings → Inventory** before term requests.
- Issue only after **approved** so stock counts stay accurate.

---

## 🆘 Troubleshooting

**Inventory missing:** Plan or permission may block the module.
**Request uniform hidden:** Parent role required; confirm inventory plan feature.
**Stock wrong:** Confirm **Mark issued** was used — approval alone does not deduct stock.

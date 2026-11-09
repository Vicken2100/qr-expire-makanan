# Security Specification: QR ExpireTracker

## 1. Data Invariants
1. `items/{itemId}` must have `id == itemId`, non-empty `name`, valid `mfgDate` (YYYY-MM-DD), valid `expDate` (YYYY-MM-DD).
2. Document ID `{itemId}` and `{scanId}` must be valid alphanumeric strings `<= 128` characters matching `^[a-zA-Z0-9_\-]+$`.
3. String lengths are strictly constrained (`name <= 100`, `batchNumber <= 50`, `notes <= 500`, `qrPayload <= 1000`).
4. Timestamps for creation and update must adhere to reasonable formats and server timestamps.
5. In order to support multi-device real-time collaboration across smartphones in warehouse/store/kitchen floors, read access to `items` and `scans` is open to connected devices, while writes validate strict schema invariants and bounds.
6. The `status` field on `scans` must be one of `['green', 'yellow', 'red']`.

## 2. The "Dirty Dozen" Threat Payloads
1. **Ghost Field Injection**: Attempt to create item with unregistered field `__isSuperAdmin: true`.
2. **Massive String Payload**: Attempt to inject a 10MB string into `name` or `notes` to exhaust storage.
3. **Invalid ID Injection**: Attempt to create item with path `/items/../../../etc/passwd` or invalid characters.
4. **Invalid Date Format**: Attempt to inject `mfgDate: "not-a-date"` or SQL injection strings.
5. **Negative / NaN Quantities**: Attempt to inject `quantity: -999999` or non-numeric types.
6. **Status Tampering in Scans**: Attempt to insert `status: "unknown_bypass"`.
7. **Unbounded Scan Device Info**: Attempt to inject excessive metadata into `deviceInfo`.
8. **Item ID Tampering**: Creating item document at `/items/item_123` with payload `{ id: "item_999" }`.
9. **Mismatched Scan Link**: Scan log pointing to non-existent or blank `itemId`.
10. **Null / Blank Name**: Attempt to save item without product name.
11. **Excessive QR Payload**: Attempt to embed binary shellcode in `qrPayload`.
12. **Malformed JSON Payload**: Invalid type injection into numeric fields like `scannedCount`.

## 3. Security Rules Defense
The Firestore rules enforce:
- Global default-deny rule on all unmatched paths.
- Helper `isValidId()` for path variables.
- Helper `isValidItem()` validating required keys, data types, string length bounds, and date regex patterns.
- Helper `isValidScan()` validating required keys, status enum constraint, and item linkage.

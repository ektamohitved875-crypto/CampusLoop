# CampusLoop Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Role Integrity**: No customer can ever create a `users/{uid}` document with `role: "admin"`, nor modify their own `role` or `status` field. Only verified server-controlled admins (`isAdmin()`) can manage admin access or suspend accounts.
2. **Listing Moderation Gate**: Customers can only create listings with `status: "pending"` and `sellerId == request.auth.uid`. Only admins can transition a listing's `status` to `"approved"`, `"rejected"`, `"flagged"`, or `"removed"`. Public/customer browse queries can only read listings where `status == "approved"` (or their own listings).
3. **PII Isolation**: User documents (`users/{uid}`) and private student profiles (`users/{uid}/profile/{profileId}`) contain email and optional phone numbers and are readable only by the owner (`request.auth.uid == uid`) or an admin (`isAdmin()`).
4. **Conversation & Request Isolation**: Inquiries, rental requests, exchange requests, and conversations are readable/writable strictly by their participating buyer/seller (or admins for reported conversations).
5. **Admin Analytics & Business Insights Isolation**: `adminAnalytics/*`, `businessInsights/*`, `categories/*` (writes), and `reports/*` (moderation) are strictly inaccessible to ordinary customers.
6. **Temporal & Structural Integrity**: Document IDs conform to `^[a-zA-Z0-9_\-]+$` (<= 128 chars), every string has explicit `.size()` bounds, `createdAt` / `updatedAt` are validated against `request.time`, and unknown shadow fields are rejected via `.keys().hasOnly(...)`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Self-Admin Registration**: `setDoc('/users/cust1', { uid: 'cust1', role: 'admin', ... })` as non-admin user -> DENIED.
2. **Role Escalation Update**: `updateDoc('/users/cust1', { role: 'admin', updatedAt: serverTimestamp() })` as `cust1` -> DENIED.
3. **Admin Allowlist Injection**: `setDoc('/admins/cust1', { uid: 'cust1', ... })` as `cust1` -> DENIED.
4. **Self-Approved Listing**: `setDoc('/listings/list1', { sellerId: 'cust1', status: 'approved', ... })` as `cust1` -> DENIED.
5. **Seller Self-Approval Update**: `updateDoc('/listings/list1', { status: 'approved', updatedAt: serverTimestamp() })` as `cust1` -> DENIED.
6. **Shadow Field Injection on Listing**: `setDoc('/listings/list2', { ..., isAdminFeatured: true })` as `cust1` -> DENIED.
7. **Cross-User PII Read**: `getDoc('/users/cust2')` or `getDoc('/users/cust2/profile/details')` as `cust1` -> DENIED.
8. **Customer Reading Business Insights**: `getDoc('/businessInsights/nexus_labs')` as `cust1` -> DENIED.
9. **Unauthorized Conversation Snooping**: `getDoc('/conversations/conv_2_3')` or `getDocs('/conversations/conv_2_3/messages')` as `cust1` (not in `participantIds`) -> DENIED.
10. **Terminal State Tampering on Rental Request**: `updateDoc('/rentalRequests/req1', { status: 'accepted' })` when `existing.status == 'completed'` as `cust1` -> DENIED.
11. **ID Poisoning / Resource Exhaustion**: `setDoc('/listings/' + 'a'.repeat(500), { ... })` -> DENIED.
12. **Customer Category Hijack**: `setDoc('/categories/free_stuff', { name: 'Free', ... })` as `cust1` -> DENIED.

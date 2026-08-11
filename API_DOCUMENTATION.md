# Mini ERP + CRM API Documentation

Welcome to the **Mini ERP + CRM API Reference Documentation**. This document covers all endpoints, authentication procedures, request/response models, and status codes for the ERP + CRM system backend.

---

## 1. Overview & Setup

* **Base URL**: `http://localhost:5000`
* **Content Type**: `application/json`
* **Authentication**: HTTP Bearer JWT Token (`Authorization: Bearer <token>`)
* **Postman Collection**: [postman_collection.json](file:///c:/Users/Manoj/OneDrive/Documents/Fund/backend/postman_collection.json)

---

## 2. Authentication & User Roles

### User Roles & Permissions

| Role | Access Level & Capabilities |
| :--- | :--- |
| `ADMIN` | Full administrative access to all endpoints, user management, and configuration. |
| `SALES` | Access to Customer CRM, Sales Challans, and CRM Task Follow-ups. |
| `WAREHOUSE` | Access to Inventory/Products, Stock Movements, and Purchase Orders. |
| `ACCOUNTS` | Access to Invoices, Financial Audit, and Payment Status updates. |

---

## 3. Endpoints Reference

### 🔐 Authentication (`/api/auth`)

#### `POST /api/auth/login`
Authenticates a user and returns a JWT access token.
* **Headers**: `Content-Type: application/json`
* **Request Body**:
```json
{
  "email": "admin@company.com",
  "password": "AdminPass123!"
}
```
* **Success Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "name": "Eleanor Vance (Admin)",
    "role": "ADMIN"
  }
}
```

---

#### `POST /api/auth/register` *(Admin Only)*
Registers a new system user.
* **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body**:
```json
{
  "email": "sarah@company.com",
  "name": "Sarah Jenkins",
  "password": "SalesPass123!",
  "role": "SALES"
}
```
* **Success Response (201 Created)**

---

#### `GET /api/auth/me`
Fetches current authenticated user profile.
* **Headers**: `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
```json
{
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "name": "Eleanor Vance (Admin)",
    "role": "ADMIN"
  }
}
```

---

### 📊 Dashboard (`/api/dashboard`)

#### `GET /api/dashboard/stats`
Fetches aggregated executive metrics and low-stock warnings.
* **Headers**: `Authorization: Bearer <token>`
* **Success Response (200 OK)**:
```json
{
  "lowStockCount": 2,
  "activeCustomersCount": 4,
  "pendingPOsCount": 2,
  "unpaidInvoicesCount": 2,
  "pendingFollowupsCount": 3,
  "lowStockProducts": [
    {
      "id": 2,
      "sku": "SKU-FURN-002",
      "name": "Executive Mesh Office Chair",
      "currentStock": 4,
      "reorderLevel": 10
    }
  ],
  "recentChallans": [
    {
      "id": 4,
      "challanNumber": "SCH-2026-004",
      "status": "DRAFT",
      "customer": { "name": "Samantha Reed", "companyName": "Horizon Creative Studio" }
    }
  ]
}
```

---

### 👥 Customers / CRM (`/api/customers`)

#### `GET /api/customers`
Retrieves paginated list of customer accounts.
* **Query Parameters**:
  * `search` *(optional)*: Filter by customer name, company, or email.
  * `type` *(optional)*: Filter by `RETAIL`, `WHOLESALE`, `DISTRIBUTOR`.
  * `status` *(optional)*: Filter by `LEAD`, `ACTIVE`, `INACTIVE`.
  * `page` *(optional, default: 1)*
  * `limit` *(optional, default: 10)*
* **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "companyName": "Acme Enterprises",
      "phone": "+1 555-0199",
      "email": "john@acme.com",
      "customerType": "DISTRIBUTOR",
      "status": "ACTIVE"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 4, "totalPages": 1 }
}
```

---

#### `POST /api/customers`
Creates a new customer account.
* **Request Body**:
```json
{
  "name": "Samantha Reed",
  "companyName": "Horizon Creative Studio",
  "phone": "+1 555-0911",
  "email": "sam@horizoncreative.io",
  "billingAddress": "12 Art Center Plaza, Seattle, WA",
  "shippingAddress": "12 Art Center Plaza, Seattle, WA",
  "customerType": "RETAIL",
  "status": "LEAD",
  "notes": "Interested in ergonomic office chairs."
}
```

---

### 📦 Products & Inventory (`/api/products`)

#### `GET /api/products`
Retrieves product catalog with current stock levels.
* **Query Parameters**:
  * `search` *(optional)*: Filter by SKU or product name.
  * `category` *(optional)*: Filter by category (e.g. `Electronics`, `Furniture`).
  * `lowStock` *(optional, boolean)*: Set to `true` to view low stock items.
* **Success Response (200 OK)**

---

#### `POST /api/products` *(Warehouse/Admin)*
Creates a new product SKU.
* **Request Body**:
```json
{
  "sku": "SKU-ELEC-006",
  "name": "4K USB-C Web Camera",
  "category": "Electronics",
  "unit": "pcs",
  "price": 129.00,
  "reorderLevel": 15,
  "currentStock": 45,
  "location": "Aisle 2 - Shelf C3"
}
```

---

### 🚚 Sales Challans (`/api/sales-challans`)

#### `GET /api/sales-challans`
Lists delivery notes / sales challans.
* **Query Parameters**: `status` (`DRAFT`, `CONFIRMED`, `DISPATCHED`, `DELIVERED`, `CANCELLED`), `search`, `customerId`

---

#### `POST /api/sales-challans`
Creates a new sales challan.
* **Request Body**:
```json
{
  "customerId": 1,
  "challanDate": "2026-08-11T00:00:00.000Z",
  "status": "CONFIRMED",
  "items": [
    { "productId": 1, "quantity": 10, "unitPrice": 35.00 }
  ]
}
```

---

#### `PATCH /api/sales-challans/:id/status`
Updates challan status. Automatically handles inventory deducts on `CONFIRMED` / `DISPATCHED`.
* **Request Body**:
```json
{
  "status": "DISPATCHED"
}
```

---

#### `POST /api/sales-challans/:id/invoice`
Generates an invoice from a Sales Challan.
* **Request Body**:
```json
{
  "dueDate": "2026-09-15T00:00:00.000Z",
  "taxRate": 18
}
```

---

### 💳 Invoices & Billing (`/api/invoices`)

#### `GET /api/invoices`
Lists billing invoices.
* **Query Parameters**: `paymentStatus` (`UNPAID`, `PARTIAL`, `PAID`), `search`, `customerId`

---

#### `PATCH /api/invoices/:id/payment`
Updates payment status.
* **Request Body**:
```json
{
  "paymentStatus": "PAID"
}
```

---

### 🛒 Purchase Orders (`/api/purchase-orders`)

#### `GET /api/purchase-orders`
Lists supplier purchase orders.

---

#### `PATCH /api/purchase-orders/:id/status`
Updates PO status (`ORDERED`, `RECEIVED`, `CANCELLED`). Setting status to `RECEIVED` automatically increments product inventory stock.

---

### 🔁 Stock Movements (`/api/stock-movements`)

#### `GET /api/stock-movements`
Retrieves inventory stock movement audit logs.

#### `POST /api/stock-movements`
Manually logs inventory intake/outtake adjustment.
* **Request Body**:
```json
{
  "productId": 2,
  "quantity": 10,
  "type": "IN",
  "reason": "Supplier manual restock",
  "notes": "Audited by Dave Miller"
}
```

---

### 📞 CRM Follow-ups (`/api/followups`)

#### `GET /api/followups`
Lists CRM task follow-ups (`status`, `type`, `assignedToId`, `customerId`).

#### `PATCH /api/followups/:id/status`
Marks follow-up task as `DONE` or `PENDING`.
```json
{
  "status": "DONE"
}
```

---

## 4. HTTP Status Code References

| Code | Meaning |
| :--- | :--- |
| `200 OK` | Request succeeded. |
| `201 Created` | Resource created successfully. |
| `400 Bad Request` | Validation failure (e.g. Zod schema error or insufficient stock). |
| `401 Unauthorized` | Missing or invalid JWT bearer token. |
| `403 Forbidden` | Insufficient role permissions for the endpoint. |
| `404 Not Found` | Requested resource ID does not exist. |
| `500 Internal Error` | Unexpected server error. |

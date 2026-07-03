# 🍽️ HiFoode – Backend API Documentation

 ## run - "npm run dev"

## 📌 Overview

HiFoode is a scalable, role-based food delivery platform backend that powers users, vendors, delivery partners, and administrators. This backend exposes secure REST APIs for authentication, catalog management, cart & orders, payments, delivery logistics, notifications, and subscriptions.

This document is intended for **backend developers, frontend developers, QA engineers, and DevOps teams** to understand the system architecture, modules, setup, testing, and API usage.

---

## 🧱 Technology Stack

* **Runtime:** Node.js (v16+)
* **Framework:** Express.js
* **Language:** TypeScript
* **Database:** PostgreSQL
* **Backend-as-a-Service:** Supabase
* **Authentication:** JWT (JSON Web Tokens)
* **ORM / Query Layer:** Supabase Client
* **Testing:** Jest, Supertest
* **API Testing:** Postman
* **Environment Management:** dotenv

---

## 📦 Key Packages

* express
* typescript
* @supabase/supabase-js
* jsonwebtoken
* dotenv
* multer (file uploads)
* uuid
* jest
* ts-jest
* supertest

---

## 🏗️ Project Architecture

```
src/
├── controllers/        # Request handling & validation
├── services/           # Business logic & DB abstraction
├── routes/             # API route definitions
├── middleware/         # Auth, role guards, error handling
├── utils/              # Helpers (pagination, error normalize)
├── config/             # Supabase, env configs
├── __tests__/          # Jest test suites (module-wise)
├── app.ts              # Express app setup
├── server.ts           # Server bootstrap
```

### Design Principles

* **Controller-Service pattern**
* **Reusable `UniqueService` & `UniqueController` for CRUD**
* **Single-responsibility modules**
* **Secure-by-default APIs**

---

## 🔐 Authentication & Authorization

### Authentication

* JWT-based authentication
* Token required in `Authorization` header:

  ```
  Authorization: Bearer <token>
  ```

### Authorization

* Role-based access control (RBAC)
* Protected routes using `authMiddleware`
* Reserved roles (e.g., `Admin`) protected from mutation

---

## 👥 Roles & Permissions

| Role             | Access Scope            |
| ---------------- | ----------------------- |
| Admin            | Full system access      |
| Sub Admin        | Region-based control    |
| Vendor           | Store, menu, order mgmt |
| User             | Browse, cart, order     |
| Delivery Partner | Pickup & delivery       |

---

## 📂 Functional Modules

* Role Management
* User Management
* Address Management
* Region Management
* Store Management
* Category & Subcategory
* Products & Brands
* Variants
* Menu
* Cart & Cart Items
* Orders & Order Items
* Delivery Assignment
* Vendors
* Payments & Payment Methods
* Refunds
* Delivery Zones & Locations
* Delivery Partners
* Notifications & Channels
* Time Slots
* User Subscriptions

---

## 🧠 Core Services

* Authentication & Authorization Service
* Role & Permission Service
* User Service
* Catalog & Menu Service
* Store & Vendor Service
* Cart & Order Service
* Payment & Refund Service
* Delivery & Logistics Service
* Notification Service
* Subscription & Scheduling Service

---

## ✨ Key Features

* Secure JWT authentication
* Role-based authorization
* Centralized CRUD via `UniqueController`
* Pagination & search support
* Referential integrity checks before delete
* Modular & scalable architecture
* Supabase error normalization
* Extensive test coverage

---

## 📑 API Documentation Standard

Each endpoint follows this structure:

* **Endpoint URL**
* **HTTP Method**
* **Authorization Required**
* **Request Body / Params**
* **Success Response**
* **Error Responses**

### Example

```http
POST /api/categories/createCategory
Authorization: Bearer <token>
```

```json
{
  "name": "Beverages"
}
```

**Success Response**

```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { "id": "uuid", "name": "Beverages" }
}
```

---

## 🔁 Pagination & Search

Most list APIs support:

* `page` (default: 1)
* `limit` (default: 10, max: 100)
* `search` (optional)

Response format:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Payment Status

🟢 1. Cash on Delivery (COD)
On Order Creation:

   orderStatus = CONFIRMED

   paymentStatus = PENDING

After Delivery:

   orderStatus = CONFIRMED

   paymentStatus = PAID

🔵 2. Online Payment (Card / UPI)
On Order Creation:

   orderStatus = PENDING

   paymentStatus = PENDING

2.1 Payment Success:

   orderStatus = CONFIRMED

   paymentStatus = PAID

2.2 Payment Failure:

   orderStatus = FAILED

   paymentStatus = FAILED

## 🧪 Testing Strategy

### Tools

* Jest
* Supertest

### Run All Tests

```bash
npm test
```

### Run Module-wise Tests

```bash
npm test role
npm test store
npm test cart
```

### Test Coverage Includes

* CRUD operations
* Auth-protected routes
* Validation & edge cases
* Reserved entity protection

---

## ⚙️ Environment Setup

### Prerequisites

* Node.js v16+
* npm or yarn
* Supabase account

### Installation

```bash
git clone <repository-url>
cd hifoodie-api
npm install
```

### Environment Variables (`.env`)

```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_key
JWT_SECRET=your_secret
```

### Run Server

```bash
npm run dev
```

---

## 🔐 Security Best Practices

* JWT expiration & verification
* Role-based route guards
* Reserved resource protection
* Centralized error handling
* Input validation at controller level
* No direct DB access from routes

---

## 🚀 Deployment Notes

* Compatible with Docker
* Supabase-managed PostgreSQL
* Environment-based configs
* Stateless API (horizontal scaling ready)

---

## 📌 Final Notes

This backend is designed to be **production-ready, testable, and scalable**. The use of generic controllers/services reduces duplication while maintaining security and clarity.

For frontend integration, refer to the **Frontend README** for API consumption patterns.

---

Happy building 🚀

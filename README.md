# 💰 Budget Control System

A full-stack web application designed to manage organizational budgets, track requests, and streamline approval workflows across different user roles.

---

## 🚀 Features

* 🔐 Authentication (Login / Signup)
* 👥 Role-Based Access Control:

  * Admin
  * Manager
  * Employee
* 💸 Budget Allocation & Tracking
* 📩 Request & Approval System
* 🔔 Notifications System
* 📊 Separate Dashboards for Each Role

---

## 🛠️ Tech Stack

### Frontend

* React (Vite)
* JavaScript
* CSS

### Backend

* Spring Boot
* Java
* Maven

### Database

* (Add your DB here: MySQL / PostgreSQL / etc.)

---

## 📁 Project Structure

```
budget-control-system/
│
├── backend/                # Spring Boot backend
│   ├── controller/         # API endpoints
│   ├── service/            # Business logic
│   ├── repository/         # Database access
│   ├── entity/             # Database models
│   └── dto/                # Data transfer objects
│
├── src/                    # React frontend
│   ├── components/
│   ├── pages/
│   └── api.js
│
└── public/
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```
git clone <repo-link>
cd budget-control-system
```

---

### 2. Backend Setup

```
cd backend
```

* Rename:

```
application.properties.example → application.properties
```

* Configure:

  * Database URL
  * Username & Password

Run:

```
mvn spring-boot:run
```

---

### 3. Frontend Setup

```
cd ..
npm install
npm run dev
```

---

## 🔐 User Roles

| Role     | Access                  |
| -------- | ----------------------- |
| Admin    | Manage budgets, users   |
| Manager  | Approve/reject requests |
| Employee | Submit requests         |

---

## 📌 Future Improvements

* JWT Authentication
* Better UI/UX design
* State management (Redux/Zustand)
* API validation improvements
* Unit & integration testing


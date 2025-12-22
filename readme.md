# ContestHub - Backend (Server)

Live API URL: [https://contestverse-shohan.netlify.app](#)

Backend for ContestHub is built with **Node.js**, **Express**, and **MongoDB**. It handles authentication, contest management, payments, role-based access, and all API endpoints required for the frontend.

## Features

1. JWT-based authentication & secure private routes
2. Role management: Admin, Contest Creator, Normal User
3. CRUD operations for contests (create, edit, delete, approve)
4. Payment integration for contest registration
5. User management (change roles, view users)
6. Winner declaration & submission tracking
7. Search & filter contests by type
8. Pagination support for tables (10 items per page)
9. Leaderboard API for ranking users by wins
10. Secure environment variable usage for MongoDB, Firebase, and payment keys
11. Sweet alert & toast friendly responses
12. Extra API routes for custom pages
13. Fully deployed on Vercel or any cloud hosting

## Tech Stack

- **Node.js** + **Express** (Backend)
- **MongoDB** + **Mongoose** (Database)
- **JWT** (Authentication & Authorization)
- **Stripe / Razorpay / PayPal** (Payment integration)
- **Cors & Express Middleware** (Security & Parsing)
- **Vercel** (Deployment)

## API Endpoints

- `POST /auth/login` – Login
- `POST /auth/register` – Register
- `GET /contests` – Get all contests (public)
- `GET /contests/:id` – Get contest details (private)
- `POST /contests` – Create contest (creator only)
- `PUT /contests/:id` – Update contest (creator/admin)
- `DELETE /contests/:id` – Delete contest (creator/admin)
- `POST /payments` – Register for contest
- `GET /leaderboard` – Get leaderboard data
- `GET /users` – Admin: get all users
- `PATCH /users/:id/role` – Admin: change user role

## Setup & Installation

1. Clone the repository:

```bash
git clone https://github.com/mehedihasanshohan/contestverse-server.git

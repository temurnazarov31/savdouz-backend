# SavdoUz Backend API

A RESTful API for SavdoUz — a business management app for retail shops and warehouses in Uzbekistan.

## Features

- 🔐 JWT Authentication
- 👥 Role-based access control (owner, worker, user)
- 🏪 Store and warehouse management
- 📦 Product and inventory management
- 💰 Transaction and sales tracking
- 📊 Reports and income analytics
- 🚚 Delivery management
- 🏷️ Barcode/QR code generation for products
- 👷 Worker invitation system via QR codes

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Security**: Helmet, Rate limiting, XSS protection, HPP

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas account

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/savdouz-backend.git
cd savdouz-backend
npm install
```

### Environment Variables

Create a `config.env` file in the root directory:

```
NODE_ENV=development
PORT=3000
DATABASE=mongodb+srv://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90
```

### Run

```bash
# Development
npm run dev

# Production
npm start
```

## License

MIT

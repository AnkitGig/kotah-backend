# Kotah Backend (MVP)

Simple backend for a parent-child tasks / rewards app.

## Quick start

1. Install dependencies

```powershell
npm install
```

2. Create a `.env` in the project root with:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/kotah
JWT_SECRET=your_jwt_secret_here
```

3. Start the server

```powershell
npm start
```

4. Import `postman_collection.json` into Postman to exercise the API.

## Main endpoints

- POST /api/auth/signup - create parent account
- POST /api/auth/login - login parent
- POST /api/auth/verify-otp - verify otp
- POST /api/auth/complete-profile - complete parent profile (multipart with avatar)
- POST /api/children - create child (parent auth, multipart with avatar)
- POST /api/children/login-by-code - child login by 6-digit code
- POST /api/tasks - create task (parent)
- POST /api/tasks/:taskId/complete - child marks complete
- POST /api/tasks/:taskId/verify - parent verifies and awards coins
- POST /api/rewards/:rewardId/claim - child claims reward

## Notes

- The project expects MongoDB running locally or via MONGO_URI.
- Avatar files are stored in `uploads/`.
- OTP sending is simulated (check response from signup for OTP in this MVP).

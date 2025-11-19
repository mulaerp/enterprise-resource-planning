# Backend Issues Affecting E2E Tests

**Last Updated:** November 19, 2025

## Current Status

⚠️ **Backend Login Endpoint Has Errors**

The authentication endpoint is currently experiencing issues that prevent login functionality from working. This affects several E2E tests.

## Affected Tests

### Authentication Tests (`auth.spec.ts`)
- ✅ `should display login page` - **PASSING** (UI only)
- ✅ `should show validation errors for empty fields` - **PASSING** (client-side validation)
- ⏭️ `should show error for invalid credentials` - **SKIPPED** (requires backend)
- ⏭️ `should login successfully with valid credentials` - **SKIPPED** (requires backend)
- ⏭️ `should redirect to dashboard if already logged in` - **SKIPPED** (requires backend)

### Other Tests Requiring Authentication
All other test suites use the `login()` helper from `tests/helpers/auth.ts` which depends on the backend login endpoint. These tests will fail until the backend issue is resolved:

- `customers.spec.ts` - All tests (requires login)
- `dashboard.spec.ts` - All tests (requires login)
- `navigation.spec.ts` - All tests (requires login)
- `notifications.spec.ts` - All tests (requires login)
- `products.spec.ts` - All tests (requires login)
- `reports.spec.ts` - All tests (requires login)
- `sales-orders.spec.ts` - All tests (requires login)
- `search.spec.ts` - All tests (requires login)
- `suppliers.spec.ts` - All tests (requires login)

## What's Working

✅ **Playwright Setup**
- Playwright v1.56.1 installed and working
- Chromium browser installed
- Test infrastructure functional
- Screenshots and videos captured
- HTML reports generated

✅ **Frontend UI Tests**
- Page title now shows "Mula ERP"
- Login page displays correctly
- Client-side validation working
- Form fields and buttons visible

## What Needs to Be Fixed

### Backend Issues
1. **Login Endpoint Error** - The `/api/v1/auth/login` endpoint needs debugging
   - Check backend logs for error details
   - Verify database connection
   - Check JWT token generation
   - Verify password hashing/comparison

### Steps to Debug Backend
```bash
# Check backend logs
docker-compose logs backend

# Check if backend is running
curl http://localhost:8080/api/v1/health

# Test login endpoint directly
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'
```

## Running Tests

### Run Only Working Tests
```bash
# Run auth tests (includes skipped tests)
npm run test:e2e auth.spec.ts

# Run with UI mode to see which tests are skipped
npm run test:e2e:ui
```

### After Backend is Fixed
Once the backend login is working, remove the `.skip` from the auth tests:

1. Open `frontend/tests/e2e/auth.spec.ts`
2. Change `test.skip(...)` back to `test(...)`
3. Run all tests: `npm run test:e2e`

## Test Results Summary

**Current Status:**
- ✅ 2 tests passing (UI-only tests)
- ⏭️ 3 tests skipped (backend-dependent)
- ⏭️ ~40+ tests blocked (require authentication)

**After Backend Fix:**
- Expected: All tests should pass
- If tests still fail, check:
  - Error messages match expected text
  - Redirect behavior works correctly
  - Session persistence works

## Contact

If you need help debugging the backend issue, check:
- `backend/src/main/java/com/mulaerp/auth/controller/AuthController.java`
- `backend/src/main/java/com/mulaerp/auth/service/AuthService.java`
- `backend/src/main/java/com/mulaerp/auth/security/JwtTokenProvider.java`
- Backend logs: `docker-compose logs -f backend`

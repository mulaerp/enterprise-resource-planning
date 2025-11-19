# How to Run Mula ERP Backend

## ✅ Compilation Fixed!

The backend now compiles successfully with Java 21.

## Prerequisites

- **Java 21** (LTS) installed
- **Maven 3.9+** installed
- **PostgreSQL** running (or use Docker Compose)

## Quick Start

### 1. Set Java 21 as Active

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
java -version  # Should show Java 21
```

### 2. Compile the Project

```bash
cd backend
mvn clean compile
```

Expected output: `BUILD SUCCESS`

### 3. Run the Application

```bash
mvn spring-boot:run
```

The application will start on `http://localhost:8080`

## Using Docker Compose (Recommended)

From the project root:

```bash
# Start all services (backend, frontend, database, cache)
docker-compose up --build

# Or start in background
docker-compose up -d --build
```

## Verify It's Working

```bash
# Health check
curl http://localhost:8080/api/v1/health

# API documentation
open http://localhost:8080/swagger-ui.html
```

## Build JAR File

```bash
# Build without running tests
mvn clean package -DskipTests

# JAR file will be in target/mula-erp-backend-1.0.0.jar
```

## Troubleshooting

### Issue: "Unsupported class file major version"
**Solution**: Make sure you're using Java 21:
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
```

### Issue: Database connection error
**Solution**: Start PostgreSQL or use Docker Compose:
```bash
docker-compose up postgres -d
```

### Issue: Port 8080 already in use
**Solution**: Stop other services or change port in `application.yml`

## Configuration

Edit `src/main/resources/application.yml` to configure:
- Database connection
- Server port
- JWT secret
- Email settings
- etc.

## Development

- **Hot reload**: Use Spring Boot DevTools (already included)
- **Debug**: Run with `-Ddebug` flag
- **Profiles**: Use `-Dspring.profiles.active=dev`

## Next Steps

1. ✅ Backend compiles successfully
2. Run the application
3. Test Phase 6 features (Purchase Orders, Invoices, Payments, etc.)
4. Run E2E tests from frontend
5. Deploy to production

---

**Status**: ✅ Ready to Run  
**Java Version**: 21 (LTS)  
**Spring Boot**: 3.4.0  
**Last Updated**: January 19, 2025

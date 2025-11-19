# Product Overview

Mula ERP is a full-featured Enterprise Resource Planning system designed for business operations management. The system provides a comprehensive platform for managing enterprise resources through a modern web interface.

## Core Components

- **Frontend**: Modern React-based user interface for end users
- **Backend**: Java Spring Boot application handling core business logic and API services
- **Middleware**: Node.js service for handling integrations and auxiliary services
- **Infrastructure**: PostgreSQL database, Valkey (Redis fork) for caching, and Nginx reverse proxy

## Key Features

- User authentication and authorization via JWT
- Integration with external CAS (Central Authentication Service)
- Batch job processing for scheduled tasks
- Automated database backups
- Caching layer for performance optimization
- RESTful API architecture

## Access Points

- Frontend UI: `http://localhost:3000` (dev) or `http://localhost` (via Nginx)
- Backend API: `http://localhost:8080` or `http://localhost/api/` (via Nginx)
- Database: PostgreSQL on port 5432
- Cache: Valkey on port 6379

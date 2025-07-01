# Enterprise Resource Planning System

This project is a full-featured Enterprise Resource Planning (ERP) system, split into three main components: 

1. **Frontend** - A modern React application for the user interface
2. **Backend** - A robust Java Spring Boot application serving the core business logic
3. **Middleware** - A simple node.js middleware to handle various integrations

## Project Structure

- **mula-erp-frontend**: React-based frontend
- **mula-erp-backend**: Java Spring Boot-based backend
- **mula-erp-middleware**: Node.js middleware

## Getting Started

This system uses Docker Compose for container orchestration. Make sure you have Docker and Docker Compose installed on your system.

### Build and Run

```bash
docker-compose up --build
```

This command builds and starts all the containers, including:
- The **Frontend** on port 3000
- The **Backend** on port 8080
- A **PostgreSQL** database on port 5432
- A **Redis Fork (Valkey)** on port 6379
- An **Nginx** reverse proxy on port 80

### Submodules

This project includes several Git submodules:

- **[mula-erp-frontend](https://github.com/rexeo-asia/mula-erp-frontend)**
- **[mula-erp-backend](https://github.com/rexeo-asia/mula-erp-backend)**
- **[mula-erp-middleware](https://github.com/rexeo-asia/mula-erp-middleware)**

Ensure that you have initialized and updated the submodules by running:

```bash
git submodule update --init --recursive
```

### Environment Variables

Some environment variables need to be set for the system to run properly. These can be set in a `.env` file which is read by Docker Compose:

- **DATABASE_PASSWORD** - Password for the PostgreSQL user
- **REDIS_PASSWORD** - Password for Redis
- **JWT_SECRET** - Secret key for JWT

### Access the Services

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Nginx Proxy: `http://localhost`

## Contributing

Feel free to fork and contribute to this project by submitting a pull request.

## License

This project is licensed under the MIT License.

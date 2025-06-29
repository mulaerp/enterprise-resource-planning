# MulaERP - Open Source Enterprise Resource Planning System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.1-blue.svg)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://docs.docker.com/compose/)

MulaERP is a comprehensive, open-source Enterprise Resource Planning (ERP) system designed for modern businesses. Built with cutting-edge technologies and inspired by industry leaders like ERPNext and Odoo, MulaERP provides a complete suite of business management tools with enterprise-grade security and scalability.

## 🚀 Features

### Core Modules
- **Dashboard**: Real-time analytics and business insights
- **Sales Management**: Complete sales pipeline and order management
- **Customer Management**: Customer relationship management with detailed profiles
- **Inventory Management**: Stock tracking, low-stock alerts, and inventory analytics
- **Invoicing**: Automated invoice generation, tracking, and payment management
- **Reports & Analytics**: Comprehensive reporting with exportable data
- **Point of Sale (POS)**: Dual-device POS system for retail operations
- **Configuration**: Centralized system configuration and settings

### Security Features
- **Encrypted Configuration**: All sensitive configuration data is encrypted at rest
- **CAS Authentication**: Integration with Central Authentication Service
- **JWT Token Security**: Secure API authentication with JWT tokens
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Comprehensive security headers for web protection
- **SSL/TLS Support**: Full HTTPS support with configurable certificates

### Technical Features
- **Containerized Deployment**: Full Docker Compose setup for production
- **Microservices Architecture**: Scalable backend with Java Enterprise JDK 24 LTS
- **High-Performance Caching**: Valkey (Redis fork) for optimal performance
- **DynamoDB Compatible**: AWS DynamoDB compatible database with local development support
- **Real-time Updates**: WebSocket support for real-time notifications
- **Batch Processing**: Automated batch job processing with configurable schedules
- **Health Monitoring**: Comprehensive health checks and monitoring

## 🏗️ Architecture

### Frontend
- **Framework**: React 18+ with TypeScript
- **Styling**: TailwindCSS with custom design system
- **Routing**: React Router DOM
- **State Management**: React Context API with encrypted configuration service
- **Icons**: Lucide React
- **Build Tool**: Vite for fast development and optimized builds

### Backend
- **Runtime**: Java Enterprise JDK 24 LTS
- **Framework**: Spring Boot with Spring Security
- **Database**: DynamoDB-compatible key-value store
- **Cache**: Valkey (Redis fork) for performance optimization
- **Authentication**: CAS (Central Authentication Service) integration
- **API**: RESTful APIs with OpenAPI documentation

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local and production deployment
- **Reverse Proxy**: Nginx with SSL termination and load balancing
- **Monitoring**: Health checks and logging aggregation
- **Backup**: Automated backup scripts for data persistence

### Security Architecture
- **Configuration Encryption**: AES-256 encryption for sensitive configuration data
- **Token-Based Authentication**: JWT tokens with configurable expiration
- **API Security**: Rate limiting, CORS, and security headers
- **Network Security**: Container network isolation and secure communication
- **Data Protection**: Encrypted data at rest and in transit

## 🛠️ Installation

### Prerequisites
- Docker 20.10+ and Docker Compose 2.0+
- Git
- Make (optional, for convenience commands)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mulaerp.git
cd mulaerp

# Initial setup (generates SSL certificates and secrets)
make setup

# Start in development mode
make dev

# Or start in production mode
make prod
```

### Manual Setup

```bash
# Clone and setup
git clone https://github.com/yourusername/mulaerp.git
cd mulaerp

# Run setup script
chmod +x scripts/*.sh
./scripts/setup.sh

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration

# Start services
docker-compose up -d

# Check health
curl http://localhost/health
```

### Environment Configuration

1. **Copy Environment File**:
   ```bash
   cp .env.example .env
   ```

2. **Configure Variables**:
   - `JWT_SECRET`: Secret key for JWT token signing (auto-generated)
   - `ENCRYPTION_KEY`: Key for configuration encryption (auto-generated)
   - `CAS_BASE_URL`: Your CAS server URL
   - `REDIS_PASSWORD`: Password for Valkey cache (auto-generated)

3. **SSL Certificates** (Production):
   - Place your SSL certificates in `nginx/ssl/`
   - Update `nginx/nginx.conf` to enable HTTPS

## 📖 Usage

### First Time Setup

1. **Access Application**: Navigate to `http://localhost` (or your domain)
2. **Login**: Use CAS authentication or demo credentials
3. **Configuration**: Navigate to Configuration page to set up:
   - Database connections
   - CAS authentication settings
   - Tax configuration
   - POS device settings
   - Batch job schedules

### POS System

The POS module supports dual-device operation:
- **Device 1**: Staff terminal for product selection and transaction processing
- **Device 2**: Customer-facing display showing cart totals and items

### Configuration Management

All sensitive configuration is encrypted and managed through the backend:
- Frontend stores only encrypted configuration data
- Backend decrypts configuration on-demand
- Configuration changes are validated and encrypted before storage
- Cache invalidation ensures real-time configuration updates

### Key Workflows

1. **Sales Process**: Create customers → Add products to inventory → Generate sales orders → Create invoices
2. **Inventory Management**: Add products → Set stock levels → Monitor low-stock alerts
3. **Reporting**: Access real-time dashboards → Generate custom reports → Export data
4. **Configuration**: Update system settings → Validate configuration → Apply changes

## 🔧 Configuration

### System Settings
- **Company Information**: Branding and basic company details
- **Localization**: Timezone, currency, and regional settings
- **Security**: Session timeouts, password policies, encryption settings

### Integration Settings
- **CAS Authentication**: External authentication service integration
- **Database**: Connection strings and performance tuning
- **Cache**: Valkey configuration and optimization
- **Batch Jobs**: Automated task scheduling and retry policies

### POS Configuration
- **Device Setup**: Configure multiple POS terminals
- **Payment Methods**: Enable cash, card, and digital payments
- **Receipt Printing**: Thermal, inkjet, or laser printer support

## 🚀 Deployment

### Development Deployment

```bash
# Start development environment
make dev

# View logs
make logs

# Access services
# Frontend: http://localhost:5173
# Backend: http://localhost:8080
# DynamoDB: http://localhost:8000
```

### Production Deployment

```bash
# Deploy to production
make deploy

# Or manually
docker-compose -f docker-compose.yml up -d

# Check health
make health
```

### Scaling

```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Scale with load balancer
docker-compose up -d --scale backend=3 --scale nginx=2
```

## 🔒 Security

### Configuration Security
- All sensitive configuration data is encrypted using AES-256
- Encryption keys are generated automatically and stored securely
- Frontend cannot access raw configuration values
- Backend validates and decrypts configuration on-demand

### Authentication Security
- CAS integration for enterprise authentication
- JWT tokens with configurable expiration
- Secure session management
- Password policy enforcement

### Network Security
- Container network isolation
- SSL/TLS encryption for all communications
- Rate limiting on API endpoints
- Security headers for web protection

### Data Security
- Encrypted data at rest
- Secure backup procedures
- Audit logging for all operations
- Data validation and sanitization

## 🔧 Development

### Local Development

```bash
# Start development environment
make dev

# Run tests
make test

# Access development tools
make shell-backend  # Backend shell
make shell-frontend # Frontend shell
make db-shell      # Database shell
make cache-shell   # Cache shell
```

### Building and Testing

```bash
# Build all images
make build

# Run comprehensive tests
make test

# Check code quality
docker-compose exec backend ./mvnw checkstyle:check
docker-compose exec frontend npm run lint
```

### Monitoring

```bash
# Monitor resource usage
make monitor

# View logs
make logs

# Health check
make health
```

## 🤝 Contributing

We welcome contributions from the community! MulaERP is built to be:

- **Modular**: Easy to extend with new features
- **Configurable**: Adaptable to different business needs
- **Enterprise-ready**: Scalable and production-tested
- **Secure**: Built with security best practices

### Development Guidelines

1. **Code Style**: Follow TypeScript and Java best practices
2. **Security**: All configuration must be encrypted
3. **Testing**: Include tests for new features
4. **Documentation**: Update README and inline documentation
5. **Containerization**: Ensure Docker compatibility

### Inspired By
- **ERPNext**: Open-source ERP functionality
- **Odoo**: Modular business application design
- **OCA (Odoo Community Association)**: Community-driven development

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Roadmap

- [x] Core ERP modules implementation
- [x] Docker containerization
- [x] Configuration encryption
- [x] CAS authentication integration
- [x] Dual-device POS system
- [ ] Advanced reporting engine
- [ ] Mobile app development
- [ ] Multi-language support
- [ ] Advanced workflow automation
- [ ] Third-party integrations (payment gateways, shipping)
- [ ] Kubernetes deployment manifests
- [ ] Advanced monitoring and alerting

## 📞 Support

- **Documentation**: [Wiki pages](https://github.com/yourusername/mulaerp/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/mulaerp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/mulaerp/discussions)
- **Security**: Report security issues to security@mulaerp.org

## 🙏 Acknowledgments

- ERPNext team for ERP inspiration
- Odoo team for modular architecture concepts
- OCA community for best practices
- React and TypeScript communities
- Docker and container ecosystem
- Spring Boot and Java communities

---

**MulaERP** - Empowering businesses with secure, scalable, open-source ERP solutions.